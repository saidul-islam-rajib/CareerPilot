from datetime import timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import DashboardCounts, DashboardSummary, OpportunitySummary, TrackDigest
from careerpilot.candidate.services.applications import upcoming_tasks
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.candidate.tracks import CompanyQuota, home_country, ordered_tracks
from careerpilot.discovery.text import normalized
from careerpilot.platform.clock import parse_iso
from careerpilot.platform.enums import ApprovalState, OpportunityDecision, OutcomeStatus


class DashboardService:
    def __init__(self, context: CandidateContext, opportunities: OpportunityService) -> None:
        self._ctx = context
        self._opportunities = opportunities

    def get(self, user_id: str) -> DashboardSummary:
        workspace = self._ctx.workspaces.get(user_id)
        recent_since = self._ctx.clock.now() - timedelta(days=self._ctx.settings.account.recent_window_days)
        settings = self._ctx.settings
        applied = {application.opportunity.id for application in workspace.applications}
        current = [application for application in workspace.applications if application.archived_at is None]
        favorites = {normalized(company) for company in workspace.preferences.favorite_companies}
        quota = CompanyQuota(limit=settings.matching.max_jobs_per_company)
        digests: list[TrackDigest] = []
        for track in ordered_tracks(workspace.preferences.tracks, settings.tracks.lead_kinds):
            visible: list[OpportunitySummary] = [
                self._opportunities.summary(workspace, oid)
                for oid in workspace.track_opportunities.get(track.id, [])
                if workspace.decisions.get(oid) is not OpportunityDecision.DISMISSED and oid not in applied
            ]
            visible.sort(key=lambda o: (normalized(o.organization) not in favorites, -o.match_score))
            shown = [o for o in visible if o.decision is OpportunityDecision.SAVED or quota.admit(o.organization)]
            digests.append(TrackDigest(track=track, opportunities=shown[: track.result_count]))
        return DashboardSummary(
            counts=DashboardCounts(
                new_matches=sum(len(d.opportunities) for d in digests),
                awaiting_approval=sum(1 for a in workspace.approvals if a.state is ApprovalState.PENDING),
                applied_this_week=sum(1 for a in current if a.applied_at and parse_iso(a.applied_at) >= recent_since),
                interviews=sum(1 for a in current if a.outcome_status is OutcomeStatus.INTERVIEW),
            ),
            pause=workspace.preferences.pause,
            last_checked_at=workspace.last_checked_at,
            tracks=digests,
            upcoming=upcoming_tasks(workspace.applications, self._ctx.clock.now(), self._ctx.settings.tracking),
            home_country=home_country(workspace, settings.account.default_country_code),
            favorite_companies=workspace.preferences.favorite_companies,
        )
