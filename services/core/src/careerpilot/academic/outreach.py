from datetime import date, timedelta

from careerpilot.academic.config import OutreachRule
from careerpilot.academic.context import AcademicContext, Stores, today
from careerpilot.academic.enums import Failure, OutreachStatus, ReplyOutcome
from careerpilot.academic.models import (
    DraftBody,
    Outreach,
    OutreachInput,
    OutreachSettings,
    ReplyBody,
    StoredOutreachSettings,
)
from careerpilot.platform.errors import conflict, validation_error
from careerpilot.platform.messages import translate

SUBJECT_KEY = "academic.outreach.subject"
BODY_KEY = "academic.outreach.body"
BACKGROUND_KEY = "academic.outreach.background"
BLOCKED = frozenset({OutreachStatus.DECLINED, OutreachStatus.STOPPED})
REPLIES = {
    ReplyOutcome.POSITIVE: OutreachStatus.REPLIED_POSITIVE,
    ReplyOutcome.CALL_REQUESTED: OutreachStatus.CALL_REQUESTED,
    ReplyOutcome.DOCUMENTS_REQUESTED: OutreachStatus.DOCUMENTS_REQUESTED,
    ReplyOutcome.NEUTRAL: OutreachStatus.REPLIED_NEUTRAL,
    ReplyOutcome.DECLINED: OutreachStatus.DECLINED,
    ReplyOutcome.DO_NOT_CONTACT: OutreachStatus.STOPPED,
}
STOPPING = frozenset({ReplyOutcome.DECLINED, ReplyOutcome.DO_NOT_CONTACT})
NEEDS_ATTENTION = frozenset({OutreachStatus.REPLIED_POSITIVE, OutreachStatus.CALL_REQUESTED, OutreachStatus.DOCUMENTS_REQUESTED})


def same_person(a: Outreach, name: str, university: str) -> bool:
    return a.supervisor_name.strip().lower() == name.strip().lower() and a.university.strip().lower() == university.strip().lower()


class OutreachService:
    def __init__(self, context: AcademicContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[Outreach]:
        return self._stores.outreach.all(user_id)

    def settings(self, user_id: str) -> OutreachSettings:
        stored = self._stores.settings.get(user_id, user_id)
        return OutreachSettings(**stored.model_dump(exclude={"id", "user_id"})) if stored else OutreachSettings()

    def effective(self, user_id: str) -> OutreachRule:
        rule, own = self._ctx.config.outreach, self.settings(user_id)
        return rule.model_copy(
            update={
                "max_per_day": own.max_per_day or rule.max_per_day,
                "max_per_department": own.max_per_department or rule.max_per_department,
                "max_per_university": own.max_per_university or rule.max_per_university,
                "follow_ups_allowed": rule.follow_ups_allowed if own.follow_ups_allowed is None else own.follow_ups_allowed,
            }
        )

    def update_settings(self, user_id: str, data: OutreachSettings) -> OutreachSettings:
        rule = self._ctx.config.outreach
        limits = [(data.max_per_day, rule.max_per_day), (data.max_per_department, rule.max_per_department)]
        limits.append((data.max_per_university, rule.max_per_university))
        if any(value is not None and value > maximum for value, maximum in limits):
            raise validation_error(Failure.LIMIT_ABOVE_MAXIMUM.value)
        self._stores.settings.save(user_id, user_id, StoredOutreachSettings(id=user_id, user_id=user_id, **data.model_dump()))
        return self.settings(user_id)

    def draft(self, user_id: str, data: DraftBody) -> Outreach:
        rule = self._ctx.config.outreach
        reference = data.research_reference.strip()
        if len(reference) < rule.min_research_reference_length:
            raise validation_error(Failure.RESEARCH_REFERENCE_REQUIRED.value)
        profile = self._ctx.workspaces.get(user_id).profile
        if not profile.full_name.strip():
            raise validation_error(Failure.PROFILE_NAME_REQUIRED.value)
        if data.program_id is not None:
            self._stores.programs.find(user_id, data.program_id)
        known = [o for o in self._stores.outreach.all(user_id) if same_person(o, data.supervisor_name, data.university)]
        if any(o.do_not_contact or o.status in BLOCKED for o in known):
            raise validation_error(Failure.OUTREACH_STOPPED.value)
        if known:
            raise conflict(Failure.DUPLICATE.value)
        params = {"supervisor": data.supervisor_name.strip(), "work": reference, "name": profile.full_name, "university": data.university}
        background = translate(BACKGROUND_KEY, {"headline": profile.headline}) if profile.headline.strip() else ""
        body = translate(BODY_KEY, {**params, "background": background}).replace("\n\n\n", "\n\n")
        outreach = Outreach(
            id=self._stores.outreach.new_id(),
            user_id=user_id,
            drafted_on=today(self._ctx),
            subject=translate(SUBJECT_KEY, params),
            body=body,
            **data.model_dump(),
        )
        return self._stores.outreach.save(user_id, outreach.id, outreach)

    def update(self, user_id: str, outreach_id: str, data: OutreachInput) -> Outreach:
        existing = self._stores.outreach.find(user_id, outreach_id)
        if len(data.body) > self._ctx.config.max_text_length:
            raise validation_error(Failure.TOO_MANY_ITEMS.value)
        updated = existing.model_copy(update=data.model_dump())
        return self._stores.outreach.save(user_id, outreach_id, updated)

    def remove(self, user_id: str, outreach_id: str) -> None:
        self._stores.outreach.find(user_id, outreach_id)
        self._stores.outreach.remove(user_id, outreach_id)

    def mark_sent(self, user_id: str, outreach_id: str, on: date | None) -> Outreach:
        outreach = self._stores.outreach.find(user_id, outreach_id)
        day = on if on is not None else today(self._ctx)
        rule = self.effective(user_id)
        everyone = self._stores.outreach.all(user_id)
        self._guard_stopped(outreach, everyone)
        self._guard_generic(outreach, rule)
        first = outreach.status is OutreachStatus.DRAFT
        if not first:
            self._guard_follow_up(outreach, rule, day)
        self._guard_limits(outreach, everyone, rule, day, first)
        if first:
            outreach.sent_on = day
        else:
            outreach.follow_ups_sent += 1
        outreach.last_sent_on = day
        outreach.status = OutreachStatus.SENT
        return self._stores.outreach.save(user_id, outreach_id, outreach)

    def record_reply(self, user_id: str, outreach_id: str, body: ReplyBody) -> Outreach:
        outreach = self._stores.outreach.find(user_id, outreach_id)
        if outreach.status is OutreachStatus.DRAFT:
            raise validation_error(Failure.NOT_SENT.value)
        outreach.status = REPLIES[body.outcome]
        outreach.replied_on = today(self._ctx)
        outreach.reply_note = body.note.strip()
        if body.outcome in STOPPING:
            outreach.do_not_contact = True
        return self._stores.outreach.save(user_id, outreach_id, outreach)

    def _guard_stopped(self, outreach: Outreach, everyone: list[Outreach]) -> None:
        stopped = [o for o in everyone if same_person(o, outreach.supervisor_name, outreach.university) and o.do_not_contact]
        if stopped or outreach.status in BLOCKED:
            raise validation_error(Failure.OUTREACH_STOPPED.value)

    def _guard_generic(self, outreach: Outreach, rule: OutreachRule) -> None:
        text = outreach.body.lower()
        reference = outreach.research_reference.strip().lower()
        if not reference or reference not in text or any(phrase in text for phrase in rule.bad_phrases):
            raise validation_error(Failure.OUTREACH_GENERIC.value)

    def _guard_follow_up(self, outreach: Outreach, rule: OutreachRule, day: date) -> None:
        if not (rule.follow_ups_allowed and outreach.allow_follow_up):
            raise validation_error(Failure.FOLLOW_UP_NOT_ALLOWED.value)
        last = outreach.last_sent_on
        if last is not None and day < last + timedelta(days=rule.follow_up_gap_days):
            raise validation_error(Failure.FOLLOW_UP_TOO_SOON.value)

    def _guard_limits(self, outreach: Outreach, everyone: list[Outreach], rule: OutreachRule, day: date, first: bool) -> None:
        sent_today = sum(1 for o in everyone if o.last_sent_on == day and o.id != outreach.id)
        if sent_today >= rule.max_per_day:
            raise validation_error(Failure.OUTREACH_LIMIT.value)
        if not first:
            return
        others = [o for o in everyone if o.sent_on is not None and o.id != outreach.id]
        university = outreach.university.strip().lower()
        department = outreach.department.strip().lower()
        at_university = [o for o in others if o.university.strip().lower() == university]
        at_department = [o for o in at_university if department and o.department.strip().lower() == department]
        if len(at_university) >= rule.max_per_university or len(at_department) >= rule.max_per_department:
            raise validation_error(Failure.OUTREACH_LIMIT.value)
