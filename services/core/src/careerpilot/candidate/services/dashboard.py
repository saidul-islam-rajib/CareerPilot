from datetime import timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import DashboardCounts, DashboardSummary, OpportunitySummary, TrackDigest
from careerpilot.candidate.services.applications import upcoming_tasks
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.platform.clock import parse_iso
from careerpilot.platform.enums import ApprovalState, OpportunityDecision, OutcomeStatus


class DashboardService:
    def __init__(self, context: CandidateContext, opportunities: OpportunityService) -> None:
        self._ctx = context
        self._opportunities = opportunities

    def get(self, user_id: str) -> DashboardSummary:
        workspace = self._ctx.workspaces.get(user_id)
        recent_since = self._ctx.clock.now() - timedelta(days=self._ctx.settings.account.recent_window_days)
        digests: list[TrackDigest] = []
        for track in sorted(workspace.preferences.tracks, key=lambda t: t.position):
            visible: list[OpportunitySummary] = [
                self._opportunities.summary(workspace, oid)
                for oid in workspace.track_opportunities.get(track.id, [])
                if workspace.decisions.get(oid) is not OpportunityDecision.DISMISSED
            ]
            visible.sort(key=lambda o: o.match_score, reverse=True)
            digests.append(TrackDigest(track=track, opportunities=visible[: track.result_count]))
        return DashboardSummary(
            counts=DashboardCounts(
                new_matches=sum(len(d.opportunities) for d in digests),
                awaiting_approval=sum(1 for a in workspace.approvals if a.state is ApprovalState.PENDING),
                applied_this_week=sum(1 for a in workspace.applications if a.applied_at and parse_iso(a.applied_at) >= recent_since),
                interviews=sum(1 for a in workspace.applications if a.outcome_status is OutcomeStatus.INTERVIEW),
            ),
            pause=workspace.preferences.pause,
            last_checked_at=workspace.last_checked_at,
            tracks=digests,
            upcoming=upcoming_tasks(workspace.applications, self._ctx.clock.now(), self._ctx.settings.tracking),
        )
