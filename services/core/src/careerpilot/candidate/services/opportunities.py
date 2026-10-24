from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import OpportunityDetail, OpportunitySummary
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.enums import OpportunityDecision
from careerpilot.platform.errors import not_found


class OpportunityService:
    def __init__(self, context: CandidateContext) -> None:
        self._ctx = context

    def detail(self, user_id: str, opportunity_id: str) -> OpportunityDetail:
        opportunity = self._ctx.opportunities.get(opportunity_id)
        if opportunity is None:
            raise not_found("opportunity")
        decision = self._ctx.workspaces.get(user_id).decisions.get(opportunity_id)
        return opportunity.model_copy(update={"decision": decision})

    def summary(self, workspace: CandidateWorkspace, opportunity_id: str) -> OpportunitySummary:
        opportunity = self._ctx.opportunities.get(opportunity_id)
        if opportunity is None:
            raise not_found("opportunity")
        return opportunity.summary().model_copy(update={"decision": workspace.decisions.get(opportunity_id)})

    def decide(self, user_id: str, opportunity_id: str, decision: OpportunityDecision) -> None:
        if self._ctx.opportunities.get(opportunity_id) is None:
            raise not_found("opportunity")
        workspace = self._ctx.workspaces.get(user_id)
        workspace.decisions[opportunity_id] = decision
        self._ctx.workspaces.save(user_id, workspace)
