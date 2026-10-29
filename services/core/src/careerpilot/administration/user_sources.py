from collections import Counter
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from careerpilot.administration.context import AdminContext
from careerpilot.administration.discovery_sync import SourceCheckRunner
from careerpilot.administration.limits import effective_source_limit
from careerpilot.administration.models import (
    AdminSourceRow,
    AuditEntry,
    NewUserSource,
    SavedSourceJob,
    SourceDefaults,
    SourceJob,
    SourceJobs,
    SourceSetup,
    UserSource,
)
from careerpilot.administration.sources import SOURCE_ID_PREFIX, SourcePolicy, is_shared
from careerpilot.discovery.models import Listing
from careerpilot.discovery.pages import host_name
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import ActorType, OpportunityStatus, SourceReview, SourceStatus, WorkArrangement
from careerpilot.platform.errors import conflict, not_found, validation_error
from careerpilot.platform.validation import require_name, require_text

AUDIT_ID_PREFIX = "aud"
ARRANGEMENT_ORDER = [WorkArrangement.ONSITE, WorkArrangement.HYBRID, WorkArrangement.REMOTE, WorkArrangement.NOT_STATED]


def no_listings() -> list[Listing]:
    return []


def nowhere(_user_id: str, listing: Listing) -> str:
    return listing.id


def from_source(listing: Listing, source_id: str) -> bool:
    return listing.status is OpportunityStatus.ACTIVE and any(source.source_id == source_id for source in listing.sources)


def arrangement_counts(listings: list[Listing]) -> dict[str, Counter[str]]:
    counts: dict[str, Counter[str]] = {}
    for listing in listings:
        if listing.status is OpportunityStatus.ACTIVE:
            for source_id in {source.source_id for source in listing.sources}:
                counts.setdefault(source_id, Counter())[listing.work_arrangement] += 1
    return counts


def arrangement_rank(value: str) -> int:
    ranks = {kind.value: index for index, kind in enumerate(ARRANGEMENT_ORDER)}
    return ranks.get(value, len(ranks))


def source_job(listing: Listing, source_id: str, listed: set[str]) -> SourceJob:
    url = next((source.url for source in listing.sources if source.source_id == source_id), listing.sources[0].url)
    return SourceJob(
        id=listing.id,
        title=listing.title,
        location=listing.location,
        country_code=listing.country_code,
        work_arrangement=listing.work_arrangement,
        deadline=listing.deadline,
        url=url,
        listed=listing.id in listed,
    )


def user_source(row: AdminSourceRow, arrangements: Mapping[str, int] | None = None) -> UserSource:
    setup = row.setup
    return UserSource(
        id=row.id,
        name=row.name,
        site_url=(setup.site_url or setup.url) if setup is not None else "",
        status=row.status,
        review=row.review,
        jobs_found=row.opportunities_found,
        added_at=row.requested_at,
        last_checked_at=row.last_checked_at,
        last_error=row.last_error,
        review_note=row.review_note,
        arrangements=dict(arrangements or {}),
    )


@dataclass(frozen=True)
class UserSourceContext:
    admin: AdminContext
    checks: SourceCheckRunner
    policy: SourcePolicy
    refresh: Callable[[str], object]
    listings: Callable[[], list[Listing]] = no_listings
    place: Callable[[str, Listing], str] = nowhere


class UserSourceService:
    def __init__(self, context: UserSourceContext) -> None:
        self._ctx = context.admin
        self._checks = context.checks
        self._policy = context.policy
        self._refresh = context.refresh
        self._listings = context.listings
        self._place = context.place

    def mine(self, user_id: str) -> list[UserSource]:
        rows = sorted(self._owned(user_id), key=lambda row: row.requested_at or "", reverse=True)
        counts = arrangement_counts(self._listings())
        return [user_source(row, counts.get(row.id)) for row in rows]

    def jobs(self, user_id: str, source_id: str) -> SourceJobs:
        row = self._own(user_id, source_id)
        workspace = self._ctx.workspaces.get(user_id)
        listed = {oid for ids in workspace.track_opportunities.values() for oid in ids}
        jobs = [source_job(listing, source_id, listed) for listing in self._listings() if from_source(listing, source_id)]
        jobs.sort(key=lambda job: (arrangement_rank(job.work_arrangement), job.title.casefold()))
        return SourceJobs(source=user_source(row, Counter(job.work_arrangement for job in jobs)), jobs=jobs)

    def save_job(self, user_id: str, source_id: str, listing_id: str) -> SavedSourceJob:
        self._own(user_id, source_id)
        listing = next((item for item in self._listings() if item.id == listing_id and from_source(item, source_id)), None)
        if listing is None:
            raise not_found("opportunity")
        return SavedSourceJob(opportunity_id=self._place(user_id, listing))

    def _own(self, user_id: str, source_id: str) -> AdminSourceRow:
        row = next((s for s in self._owned(user_id) if s.id == source_id), None)
        if row is None:
            raise not_found("source")
        return row

    def add(self, user_id: str, request: NewUserSource) -> UserSource:
        note = self._note(request.note)
        mine = {row.id for row in self._owned(user_id)}
        located = self._policy.locate(request.url, self._ctx.directory.sources(), SourceDefaults())
        if located.existing is not None and located.existing.id not in mine:
            self._require_room(user_id)
        if located.existing is not None:
            return self._join(user_id, located.existing)
        if located.setup is None:
            raise validation_error("jobs_not_found")
        self._require_room(user_id)
        return self._create(user_id, request.name.strip() or located.name or host_name(located.site_url), located.setup, note)

    def remove(self, user_id: str, source_id: str) -> None:
        row = self._own(user_id, source_id)
        owners = [owner for owner in row.owner_ids if owner != user_id]
        update: dict[str, object] = {"owner_ids": owners}
        if not owners and not is_shared(row):
            update.update({"enabled": False, "status": SourceStatus.DISABLED})
        self._ctx.directory.save_source(row.model_copy(update=update))
        self._record(user_id, "source.removed", row.name)

    def _create(self, user_id: str, name: str, setup: SourceSetup, note: str) -> UserSource:
        row = AdminSourceRow(
            id=self._ctx.ids.next(SOURCE_ID_PREFIX),
            name=require_name(name, self._ctx.settings.validation.name),
            status=SourceStatus.HEALTHY,
            enabled=True,
            failuresLast24h=0,
            opportunities_found=0,
            setup=setup,
            review=SourceReview.PENDING,
            owner_ids=[user_id],
            requested_at=iso(self._ctx.clock.now()),
            request_note=note,
        )
        self._ctx.directory.save_source(row)
        self._record(user_id, "source.requested", row.name)
        checked, _check = self._checks.check(row.id)
        self._refresh(user_id)
        return user_source(checked)

    def _join(self, user_id: str, row: AdminSourceRow) -> UserSource:
        if is_shared(row):
            raise conflict("source_shared" if row.enabled else "source_disabled")
        if user_id in row.owner_ids:
            raise conflict("source_exists")
        revived = not row.owner_ids and not row.enabled
        if not row.enabled and not revived:
            raise conflict("source_disabled")
        self._require_room(user_id)
        update: dict[str, object] = {"owner_ids": [*row.owner_ids, user_id]}
        if revived:
            update.update({"enabled": True, "status": SourceStatus.HEALTHY})
        joined = row.model_copy(update=update)
        self._ctx.directory.save_source(joined)
        self._record(user_id, "source.joined", joined.name)
        if revived:
            joined, _check = self._checks.check(joined.id)
        self._refresh(user_id)
        return user_source(joined)

    def _owned(self, user_id: str) -> list[AdminSourceRow]:
        return [row for row in self._ctx.directory.sources() if user_id in row.owner_ids]

    def _require_room(self, user_id: str) -> None:
        limit = effective_source_limit(self._ctx.platform.get(), self._ctx.settings.job_sources)
        if len(self._owned(user_id)) >= limit:
            raise validation_error("source_limit")

    def _note(self, note: str) -> str:
        return require_text(note, self._ctx.settings.validation.note) if note.strip() else ""

    def _record(self, user_id: str, action: str, target: str) -> None:
        account = self._ctx.accounts.get(user_id)
        self._ctx.audit.append(
            AuditEntry(
                id=self._ctx.ids.next(AUDIT_ID_PREFIX),
                at=iso(self._ctx.clock.now()),
                actor_name=account.user.full_name if account is not None else user_id,
                actor_type=ActorType.USER,
                action=action,
                target=target,
            )
        )
