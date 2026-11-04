from careerpilot.academic.context import AcademicContext, Stores, today
from careerpilot.academic.enums import DraftKind, Failure, ReceiptEvidence, RecommendationStatus
from careerpilot.academic.models import (
    EvidenceBody,
    MessageDraft,
    Recommendation,
    RecommendationInput,
    Referee,
    RefereeInput,
)
from careerpilot.platform.errors import validation_error
from careerpilot.platform.messages import translate

DRAFT_KEYS = {DraftKind.REQUEST: "academic.referees.request", DraftKind.REMINDER: "academic.referees.reminder"}
DEADLINE_UNKNOWN_KEY = "academic.referees.noDeadline"
EVIDENCE_STATES = frozenset({RecommendationStatus.SUBMITTED, RecommendationStatus.CONFIRMED})


class RefereeService:
    def __init__(self, context: AcademicContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[Referee]:
        return self._stores.referees.all(user_id)

    def create(self, user_id: str, data: RefereeInput) -> Referee:
        referee = Referee(id=self._stores.referees.new_id(), user_id=user_id, **data.model_dump())
        return self._stores.referees.save(user_id, referee.id, referee)

    def update(self, user_id: str, referee_id: str, data: RefereeInput) -> Referee:
        existing = self._stores.referees.find(user_id, referee_id)
        updated = Referee(id=referee_id, user_id=user_id, consent_confirmed_on=existing.consent_confirmed_on, **data.model_dump())
        return self._stores.referees.save(user_id, referee_id, updated)

    def set_consent(self, user_id: str, referee_id: str, confirmed: bool) -> Referee:
        referee = self._stores.referees.find(user_id, referee_id)
        referee.consent_confirmed_on = today(self._ctx) if confirmed else None
        if not confirmed:
            self._withdraw(user_id, referee_id)
        return self._stores.referees.save(user_id, referee_id, referee)

    def remove(self, user_id: str, referee_id: str) -> None:
        self._stores.referees.find(user_id, referee_id)
        self._withdraw(user_id, referee_id)
        for recommendation in self._stores.recommendations.all(user_id):
            if recommendation.referee_id == referee_id:
                self._stores.recommendations.remove(user_id, recommendation.id)
        self._stores.referees.remove(user_id, referee_id)

    def recommendations(self, user_id: str, program_id: str | None = None) -> list[Recommendation]:
        found = self._stores.recommendations.all(user_id)
        return [r for r in found if program_id is None or r.program_id == program_id]

    def add_recommendation(self, user_id: str, data: RecommendationInput) -> Recommendation:
        self._check(user_id, data)
        recommendation = Recommendation(id=self._stores.recommendations.new_id(), user_id=user_id, **data.model_dump())
        return self._stores.recommendations.save(user_id, recommendation.id, recommendation)

    def update_recommendation(self, user_id: str, recommendation_id: str, data: RecommendationInput) -> Recommendation:
        existing = self._stores.recommendations.find(user_id, recommendation_id)
        self._check(user_id, data)
        updated = Recommendation(
            id=recommendation_id,
            user_id=user_id,
            status=existing.status,
            evidence=existing.evidence,
            evidence_note=existing.evidence_note,
            evidence_on=existing.evidence_on,
            **data.model_dump(),
        )
        return self._stores.recommendations.save(user_id, recommendation_id, updated)

    def remove_recommendation(self, user_id: str, recommendation_id: str) -> None:
        self._stores.recommendations.find(user_id, recommendation_id)
        self._stores.recommendations.remove(user_id, recommendation_id)

    def record_status(self, user_id: str, recommendation_id: str, body: EvidenceBody) -> Recommendation:
        recommendation = self._stores.recommendations.find(user_id, recommendation_id)
        if body.status in EVIDENCE_STATES:
            self._require_evidence(body)
            recommendation.evidence = body.evidence
            recommendation.evidence_note = body.evidence_note.strip()
            recommendation.evidence_on = body.on or today(self._ctx)
        else:
            recommendation.evidence = None
            recommendation.evidence_note = ""
            recommendation.evidence_on = None
        recommendation.status = body.status
        return self._stores.recommendations.save(user_id, recommendation_id, recommendation)

    def draft(self, user_id: str, recommendation_id: str, kind: DraftKind) -> MessageDraft:
        recommendation = self._stores.recommendations.find(user_id, recommendation_id)
        referee = self._stores.referees.find(user_id, recommendation.referee_id)
        if referee.consent_confirmed_on is None:
            raise validation_error(Failure.REFEREE_CONSENT_REQUIRED.value)
        program = self._stores.programs.find(user_id, recommendation.program_id)
        name = self._ctx.workspaces.get(user_id).profile.full_name
        due = recommendation.referee_deadline.isoformat() if recommendation.referee_deadline else translate(DEADLINE_UNKNOWN_KEY)
        params = {"referee": referee.name, "name": name, "program": program.title, "university": program.university, "deadline": due}
        key = DRAFT_KEYS[kind]
        return MessageDraft(subject=translate(f"{key}.subject", params), body=translate(f"{key}.body", params))

    def _check(self, user_id: str, data: RecommendationInput) -> None:
        referee = self._stores.referees.find(user_id, data.referee_id)
        self._stores.programs.find(user_id, data.program_id)
        if referee.consent_confirmed_on is None:
            raise validation_error(Failure.REFEREE_CONSENT_REQUIRED.value)

    def _require_evidence(self, body: EvidenceBody) -> None:
        if body.evidence is None:
            raise validation_error(Failure.EVIDENCE_REQUIRED.value)
        if body.evidence is ReceiptEvidence.USER_STATEMENT and not body.evidence_note.strip():
            raise validation_error(Failure.EVIDENCE_REQUIRED.value)
        if body.status is RecommendationStatus.CONFIRMED and body.evidence is not ReceiptEvidence.INSTITUTION_CONFIRMATION:
            raise validation_error(Failure.EVIDENCE_REQUIRED.value)

    def _withdraw(self, user_id: str, referee_id: str) -> None:
        for recommendation in self._stores.recommendations.all(user_id):
            if recommendation.referee_id == referee_id and recommendation.invite_authorized:
                recommendation.invite_authorized = False
                self._stores.recommendations.save(user_id, recommendation.id, recommendation)
        for program in self._stores.programs.all(user_id):
            kept = [i for i in program.portal.invites if i.referee_id != referee_id or i.invited_on is not None]
            if len(kept) != len(program.portal.invites):
                program.portal.invites = kept
                self._stores.programs.save(user_id, program.id, program)
