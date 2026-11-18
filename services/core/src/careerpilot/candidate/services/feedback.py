from careerpilot.candidate.context import CandidateContext, ChangeListener, ignore_change
from careerpilot.candidate.models import FeedbackInput, MatchFeedback
from careerpilot.platform.clock import iso
from careerpilot.platform.errors import not_found, validation_error


class FeedbackService:
    def __init__(self, context: CandidateContext, on_change: ChangeListener = ignore_change) -> None:
        self._ctx = context
        self._on_change = on_change

    def give(self, user_id: str, opportunity_id: str, body: FeedbackInput) -> MatchFeedback:
        opportunity = self._ctx.opportunities.get(opportunity_id)
        if opportunity is None:
            raise not_found("opportunity")
        workspace = self._ctx.workspaces.get(user_id)
        if opportunity_id not in workspace.feedback and len(workspace.feedback) >= self._ctx.settings.matching.feedback.max_entries:
            raise validation_error("feedback_limit")
        entry = MatchFeedback(
            opportunity_id=opportunity_id,
            verdict=body.verdict,
            reasons=list(dict.fromkeys(body.reasons)),
            title=opportunity.title,
            organization=opportunity.organization,
            created_at=iso(self._ctx.clock.now()),
        )
        workspace.feedback[opportunity_id] = entry
        self._ctx.workspaces.save(user_id, workspace)
        self._on_change(user_id)
        return entry

    def remove(self, user_id: str, opportunity_id: str) -> None:
        workspace = self._ctx.workspaces.get(user_id)
        if workspace.feedback.pop(opportunity_id, None) is not None:
            self._ctx.workspaces.save(user_id, workspace)
            self._on_change(user_id)
