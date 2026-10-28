from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.administration.context import AdminContext
from careerpilot.administration.discovery_sync import SourceCheckRunner
from careerpilot.administration.models import AdminSourceRow, AuditEntry, NewUserSource, SourceDefaults, SourceSetup, UserSource
from careerpilot.administration.sources import SOURCE_ID_PREFIX, SourcePolicy, is_shared, source_at
from careerpilot.discovery.pages import host_name
from careerpilot.discovery.resolver import normalized_link
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import ActorType, SourceReview, SourceStatus
from careerpilot.platform.errors import conflict, not_found, validation_error
from careerpilot.platform.validation import require_name, require_text

AUDIT_ID_PREFIX = "aud"


def user_source(row: AdminSourceRow) -> UserSource:
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
    )


@dataclass(frozen=True)
class UserSourceContext:
    admin: AdminContext
    checks: SourceCheckRunner
    policy: SourcePolicy
    refresh: Callable[[str], object]


class UserSourceService:
    def __init__(self, context: UserSourceContext) -> None:
        self._ctx = context.admin
        self._checks = context.checks
        self._policy = context.policy
        self._refresh = context.refresh
        self._limit = context.admin.settings.job_sources.max_per_user

    def mine(self, user_id: str) -> list[UserSource]:
        rows = sorted(self._owned(user_id), key=lambda row: row.requested_at or "", reverse=True)
        return [user_source(row) for row in rows]

    def add(self, user_id: str, request: NewUserSource) -> UserSource:
        site_url = self._policy.check_address(normalized_link(request.url))
        if site_url is None:
            raise validation_error("source_url")
        note = self._note(request.note)
        existing = source_at(self._ctx.directory.sources(), site_url)
        if existing is not None:
            return self._join(user_id, existing)
        self._require_room(user_id)
        resolved = self._policy.resolved_setup(site_url, SourceDefaults())
        if resolved is None:
            raise validation_error("jobs_not_found")
        setup, found_name = resolved
        existing = source_at(self._ctx.directory.sources(), setup.url)
        if existing is not None:
            return self._join(user_id, existing)
        return self._create(user_id, request.name.strip() or found_name or host_name(site_url), setup, note)

    def remove(self, user_id: str, source_id: str) -> None:
        row = next((s for s in self._owned(user_id) if s.id == source_id), None)
        if row is None:
            raise not_found("source")
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
        if len(self._owned(user_id)) >= self._limit:
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
