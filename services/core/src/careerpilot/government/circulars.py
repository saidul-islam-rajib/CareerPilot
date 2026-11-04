import hashlib
import json
from dataclasses import dataclass
from datetime import date, time

from careerpilot.administration.context import AdminActor
from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.government.connector import TeletalkReader
from careerpilot.government.eligibility import EligibilityChecker, FactReader, ProfileFacts
from careerpilot.government.models import (
    Circular,
    CircularContent,
    CircularSummary,
    CircularVersion,
    CircularView,
    ConnectorDraft,
    DeadlineNote,
    ListFilters,
    Notice,
    Post,
    PostSummary,
)
from careerpilot.government.ports import CircularRepository
from careerpilot.government.workdays import WorkCalendar, clock_time
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.config import GovernmentConfig
from careerpilot.platform.enums import (
    AdminArea,
    CircularPhase,
    CircularStatus,
    DeadlineSubject,
    Eligibility,
    PermissionAction,
)
from careerpilot.platform.errors import not_found, validation_error

CIRCULAR_PREFIX = "circ"
POST_PREFIX = "post"
NOTICE_PREFIX = "ntc"
REMOVE_REASON = "removed by an administrator"
AUDIT_PREFIX = "government.circular."
FINGERPRINT_EXCLUDED = frozenset({"source_text"})


def fingerprint_of(content: CircularContent) -> str:
    data = content.model_dump(mode="json", exclude=set(FINGERPRINT_EXCLUDED))
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def changed_fields(before: CircularContent, after: CircularContent) -> list[str]:
    old, new = before.model_dump(mode="json"), after.model_dump(mode="json")
    return sorted(name for name in new if old.get(name) != new[name])


@dataclass(frozen=True)
class CircularContext:
    config: GovernmentConfig
    clock: Clock
    ids: IdGenerator
    circulars: CircularRepository
    workspaces: WorkspaceRepository
    calendar: WorkCalendar
    reader: TeletalkReader


class CircularService:
    def __init__(self, context: CircularContext) -> None:
        self._ctx = context
        self._checker = EligibilityChecker(context.config)
        self._facts = FactReader(context.config)

    def today(self) -> date:
        return self._ctx.calendar.local_date(self._ctx.clock.now())

    def phase(self, circular: Circular) -> CircularPhase:
        today = self.today()
        if circular.opens_on is not None and circular.opens_on > today:
            return CircularPhase.UPCOMING
        if circular.closes_on is not None and circular.closes_on < today:
            return CircularPhase.CLOSED
        return CircularPhase.OPEN

    def published(self, circular_id: str) -> Circular:
        circular = self._ctx.circulars.get(circular_id)
        if circular is None or circular.status is not CircularStatus.PUBLISHED:
            raise not_found("circular")
        return circular

    def _facts_for(self, user_id: str) -> ProfileFacts:
        return self._facts.read(self._ctx.workspaces.get(user_id).profile)

    def list_for(self, user_id: str, filters: ListFilters) -> list[CircularSummary]:
        facts = self._facts_for(user_id)
        summaries = [
            summary
            for circular in self._ctx.circulars.list_all()
            if circular.status is CircularStatus.PUBLISHED
            if (summary := self._summary(circular, facts, filters)) is not None
        ]
        return sorted(summaries, key=lambda s: (s.closes_on is None, s.closes_on or date.max, s.title))

    def _summary(self, circular: Circular, facts: ProfileFacts, filters: ListFilters) -> CircularSummary | None:
        phase = self.phase(circular)
        if filters.phase is not None and phase is not filters.phase:
            return None
        if filters.authority and filters.authority.casefold() not in f"{circular.authority} {circular.ministry}".casefold():
            return None
        posts = [self._post_summary(circular, post, facts) for post in circular.posts if self._post_matches(post, filters)]
        if filters.eligible_only:
            posts = [post for post in posts if post.eligibility is not Eligibility.NOT_MET]
        if not posts:
            return None
        return CircularSummary(
            id=circular.id,
            title=circular.title,
            authority=circular.authority,
            closes_on=circular.closes_on,
            phase=phase,
            amended=len(circular.versions) > 1,
            vacancies=sum(post.vacancies or 0 for post in posts),
            posts=posts,
        )

    @staticmethod
    def _post_matches(post: Post, filters: ListFilters) -> bool:
        if filters.grades and post.grade not in filters.grades:
            return False
        if filters.grade_min is not None and (post.grade is None or post.grade < filters.grade_min):
            return False
        if filters.grade_max is not None and (post.grade is None or post.grade > filters.grade_max):
            return False
        return not filters.location or filters.location.casefold() in post.location.casefold()

    def _post_summary(self, circular: Circular, post: Post, facts: ProfileFacts) -> PostSummary:
        low, high = self._pay(post)
        return PostSummary(
            id=post.id,
            title=post.title,
            grade=post.grade,
            pay_min=low,
            pay_max=high,
            vacancies=post.vacancies,
            location=post.location,
            eligibility=self._checker.check(circular, post, facts).overall,
        )

    def _pay(self, post: Post) -> tuple[int | None, int | None]:
        if post.pay_min is not None or post.pay_max is not None:
            return post.pay_min, post.pay_max
        scale = next((g for g in self._ctx.config.grades if g.grade == post.grade), None)
        return (scale.pay_min, scale.pay_max) if scale else (None, None)

    def view_for(self, user_id: str, circular_id: str) -> CircularView:
        circular = self.published(circular_id)
        facts = self._facts_for(user_id)
        return self._view(circular, facts)

    def _view(self, circular: Circular, facts: ProfileFacts) -> CircularView:
        shown = circular.model_copy(deep=True)
        for post in shown.posts:
            post.pay_min, post.pay_max = self._pay(post)
        return CircularView(
            circular=shown,
            phase=self.phase(circular),
            amended=len(circular.versions) > 1,
            close_note=self.close_note(circular),
            grades=sorted({post.grade for post in circular.posts if post.grade is not None}),
            posts=[self._checker.check(circular, post, facts) for post in circular.posts],
        )

    def close_note(self, circular: Circular) -> DeadlineNote | None:
        if circular.closes_on is None:
            return None
        at: time | None = clock_time(circular.closes_time) if circular.closes_time else None
        return self._ctx.calendar.note(DeadlineSubject.APPLICATION_CLOSE, circular.closes_on, at)

    def version_for(self, circular_id: str, version: int) -> CircularVersion:
        circular = self.published(circular_id)
        found = next((v for v in circular.versions if v.version == version), None)
        if found is None:
            raise not_found("version")
        return found

    def admin_list(self, actor: AdminActor) -> list[Circular]:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.READ)
        return sorted(self._ctx.circulars.list_all(), key=lambda c: c.title)

    def admin_get(self, actor: AdminActor, circular_id: str) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.READ)
        return self._load(circular_id)

    def _load(self, circular_id: str) -> Circular:
        circular = self._ctx.circulars.get(circular_id)
        if circular is None:
            raise not_found("circular")
        return circular

    def _prepare(self, content: CircularContent) -> CircularContent:
        limits = self._ctx.config.limits
        if len(content.posts) > limits.max_posts or len(content.notices) > limits.max_notices:
            raise validation_error("too_many")
        if len(content.source_text) > limits.max_text_chars:
            raise validation_error("text_too_long")
        if content.closes_time:
            clock_time(content.closes_time)
        posts = [post.model_copy(update={"id": post.id or self._ctx.ids.next(POST_PREFIX)}) for post in content.posts]
        notices = [n.model_copy(update={"id": n.id or self._ctx.ids.next(NOTICE_PREFIX)}) for n in content.notices]
        return content.model_copy(update={"posts": posts, "notices": notices})

    def create(self, actor: AdminActor, content: CircularContent) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        prepared = self._prepare(content)
        circular = Circular(id=self._ctx.ids.next(CIRCULAR_PREFIX), **prepared.model_dump())
        circular.fingerprint = fingerprint_of(prepared)
        circular.captured_at = iso(self._ctx.clock.now())
        self._ctx.circulars.save(circular)
        actor.record(f"{AUDIT_PREFIX}created", circular.title)
        return circular

    def update(self, actor: AdminActor, circular_id: str, content: CircularContent) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        existing = self._load(circular_id)
        prepared = self._prepare(content)
        fingerprint = fingerprint_of(prepared)
        updated = Circular.model_validate({**existing.model_dump(), **prepared.model_dump()})
        if fingerprint != existing.fingerprint:
            updated.fingerprint = fingerprint
            updated.captured_at = iso(self._ctx.clock.now())
            if existing.status is CircularStatus.PUBLISHED:
                updated.version = existing.version + 1
                updated.versions = [*existing.versions, self._snapshot(updated, changed_fields(existing, prepared))]
        self._ctx.circulars.save(updated)
        actor.record(f"{AUDIT_PREFIX}updated", updated.title)
        return updated

    def _snapshot(self, circular: Circular, changed: list[str]) -> CircularVersion:
        content = CircularContent.model_validate(circular.model_dump(include=set(CircularContent.model_fields)))
        return CircularVersion(
            version=circular.version,
            fingerprint=circular.fingerprint,
            captured_at=circular.captured_at,
            changed=changed,
            snapshot=content.model_dump(mode="json", by_alias=True),
        )

    def publish(self, actor: AdminActor, circular_id: str) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        circular = self._load(circular_id)
        if not circular.posts:
            raise validation_error("posts_required")
        if circular.status is not CircularStatus.PUBLISHED:
            circular.status = CircularStatus.PUBLISHED
            if not circular.versions:
                circular.versions = [self._snapshot(circular, [])]
            self._ctx.circulars.save(circular)
            actor.record(f"{AUDIT_PREFIX}published", circular.title)
        return circular

    def withdraw(self, actor: AdminActor, circular_id: str) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        circular = self._load(circular_id)
        circular.status = CircularStatus.WITHDRAWN
        self._ctx.circulars.save(circular)
        actor.record(f"{AUDIT_PREFIX}withdrawn", circular.title)
        return circular

    def mark_live_removed(self, actor: AdminActor, circular_id: str, removed: bool) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        circular = self._load(circular_id)
        circular.live_removed = removed
        self._ctx.circulars.save(circular)
        actor.record(f"{AUDIT_PREFIX}live_removed", circular.title)
        return circular

    def add_notice(self, actor: AdminActor, circular_id: str, notice: Notice) -> Circular:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        circular = self._load(circular_id)
        if len(circular.notices) >= self._ctx.config.limits.max_notices:
            raise validation_error("too_many")
        circular.notices.append(notice.model_copy(update={"id": self._ctx.ids.next(NOTICE_PREFIX)}))
        self._ctx.circulars.save(circular)
        actor.record(f"{AUDIT_PREFIX}notice_added", circular.title)
        return circular

    def remove(self, actor: AdminActor, circular_id: str) -> None:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.DELETE)
        circular = self._load(circular_id)
        self._ctx.circulars.remove(circular_id, REMOVE_REASON)
        actor.record(f"{AUDIT_PREFIX}removed", circular.title)

    def import_from_link(self, actor: AdminActor, url: str) -> ConnectorDraft:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        draft = self._ctx.reader.read(url)
        actor.record(f"{AUDIT_PREFIX}imported", draft.content.title)
        return draft
