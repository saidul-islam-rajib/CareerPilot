from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import OpportunityDetail, OpportunitySummary
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.enums import OpportunityDecision
from careerpilot.platform.errors import not_found


class OpportunityService:
    def __init__(self, context: CandidateContext) -> None:
        self._ctx = context

    def detail(self, user_id: str, opportunity_id: str) -> OpportunityDetail:
        return self._personalized(self._ctx.workspaces.get(user_id), opportunity_id)

    def summary(self, workspace: CandidateWorkspace, opportunity_id: str) -> OpportunitySummary:
        return self._personalized(workspace, opportunity_id).summary()

    def _personalized(self, workspace: CandidateWorkspace, opportunity_id: str) -> OpportunityDetail:
        opportunity = self._ctx.opportunities.get(opportunity_id)
        if opportunity is None:
            raise not_found("opportunity")
        update: dict[str, object] = {"decision": workspace.decisions.get(opportunity_id)}
        match = workspace.matches.get(opportunity_id)
        if match is not None:
            update |= {
                "match_score": match.score,
                "match_factors": match.factors,
                "requirements": match.requirements,
                "has_hard_failure": match.has_hard_failure,
            }
        return opportunity.model_copy(update=update)

    def decide(self, user_id: str, opportunity_id: str, decision: OpportunityDecision) -> None:
        if self._ctx.opportunities.get(opportunity_id) is None:
            raise not_found("opportunity")
        workspace = self._ctx.workspaces.get(user_id)
        workspace.decisions[opportunity_id] = decision
        self._ctx.workspaces.save(user_id, workspace)
