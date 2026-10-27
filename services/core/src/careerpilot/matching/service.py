from collections.abc import Callable
from dataclasses import dataclass, field

from careerpilot.candidate.models import ArchivedCircular, OpportunityDetail, OpportunityMatch, SourceRef, Track
from careerpilot.candidate.ports import AccountRepository, CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.discovery.models import Listing
from careerpilot.matching.ports import Matcher
from careerpilot.matching.rules import is_eligible, sponsorship_evidence
from careerpilot.platform.config import MatchingConfig
from careerpilot.platform.enums import ApplicationMode, ApplicationRoute
from careerpilot.platform.validation import EMAIL_IN_TEXT


@dataclass
class RematchState:
    listings: list[Listing]
    listed: set[str]
    acted_on: set[str]
    placed: set[str] = field(default_factory=set[str])
    automatic: list[str] = field(default_factory=list[str])


@dataclass(frozen=True)
class RecommendationContext:
    config: MatchingConfig
    matcher: Matcher
    listings: Callable[[], list[Listing]]
    source_name: Callable[[str], str]
    accounts: AccountRepository
    opportunities: OpportunityRepository
    workspaces: WorkspaceRepository
    apply_by_rule: Callable[[str, str], None]


class RecommendationService:
    def __init__(self, context: RecommendationContext) -> None:
        self._ctx = context

    def refresh_all(self) -> int:
        return sum(self.refresh(user_id) for user_id in self._ctx.accounts.active_ids())

    def refresh(self, user_id: str) -> int:
        workspace = self._ctx.workspaces.get(user_id)
        listings = self._ctx.listings()
        assessed_before = len(workspace.matches)
        automatic: list[str] = []
        added = sum(self._refresh_track(workspace, track, listings, automatic) for track in workspace.preferences.tracks)
        if added or len(workspace.matches) != assessed_before:
            self._ctx.workspaces.save(user_id, workspace)
        for opportunity_id in automatic:
            self._ctx.apply_by_rule(user_id, opportunity_id)
        return added

    def _refresh_track(self, workspace: CandidateWorkspace, track: Track, listings: list[Listing], automatic: list[str]) -> int:
        current = workspace.track_opportunities.get(track.id, [])
        candidates = [
            item
            for item in listings
            if item.id not in current and item.id not in workspace.matches and is_eligible(item, track, self._ctx.config)
        ]
        assessed = [(item, self._ctx.matcher.assess(workspace.profile, track, item)) for item in candidates]
        for item, match in assessed:
            workspace.matches[item.id] = match
        qualified = sorted(
            ((item, match) for item, match in assessed if match.score >= self._ctx.config.min_score),
            key=lambda pair: pair[1].score,
            reverse=True,
        )[: max(0, track.result_count - len(current))]
        for listing, match in qualified:
            self._publish(listing, match)
            if track.mode is ApplicationMode.AUTOMATIC and not match.has_hard_failure:
                automatic.append(listing.id)
        workspace.track_opportunities[track.id] = [*current, *(listing.id for listing, _ in qualified)]
        return len(qualified)

    def rematch(self, user_id: str) -> int:
        workspace = self._ctx.workspaces.get(user_id)
        listings = self._ctx.listings()
        state = RematchState(listings=listings, listed={item.id for item in listings}, acted_on=acted_on_opportunities(workspace))
        tracks = sorted(workspace.preferences.tracks, key=lambda t: t.position)
        added = sum(self._rebuild_track(workspace, track, state) for track in tracks)
        self._ctx.workspaces.save(user_id, workspace)
        for opportunity_id in state.automatic:
            self._ctx.apply_by_rule(user_id, opportunity_id)
        return added

    def _rebuild_track(self, workspace: CandidateWorkspace, track: Track, state: "RematchState") -> int:
        previous = workspace.track_opportunities.get(track.id, [])
        acted_on, placed = state.acted_on, state.placed
        kept = [oid for oid in previous if (oid in acted_on or oid not in state.listed) and oid not in placed]
        taken = acted_on | placed
        candidates = [item for item in state.listings if item.id not in taken and is_eligible(item, track, self._ctx.config)]
        assessed = [(item, self._ctx.matcher.assess(workspace.profile, track, item)) for item in candidates]
        for item, match in assessed:
            workspace.matches[item.id] = match
        best = sorted(
            ((item, match) for item, match in assessed if match.score >= self._ctx.config.min_score),
            key=lambda pair: pair[1].score,
            reverse=True,
        )[: max(0, track.result_count - len(kept))]
        for listing, match in best:
            self._publish(listing, match)
            if track.mode is ApplicationMode.AUTOMATIC and not match.has_hard_failure and listing.id not in previous:
                state.automatic.append(listing.id)
        chosen = [*kept, *(listing.id for listing, _ in best)]
        placed.update(chosen)
        workspace.track_opportunities[track.id] = chosen
        return len([oid for oid in chosen if oid not in previous])

    def _publish(self, listing: Listing, match: OpportunityMatch) -> None:
        if self._ctx.opportunities.get(listing.id) is not None:
            return
        self._ctx.opportunities.save(opportunity_from_listing(listing, match, self._ctx.source_name, self._ctx.config))


def acted_on_opportunities(workspace: CandidateWorkspace) -> set[str]:
    return {
        *workspace.decisions,
        *(approval.opportunity.id for approval in workspace.approvals),
        *(application.opportunity.id for application in workspace.applications),
    }


def opportunity_from_listing(
    listing: Listing, match: OpportunityMatch, source_name: Callable[[str], str], config: MatchingConfig
) -> OpportunityDetail:
    source = listing.sources[0]
    original = listing.versions[0]
    found = EMAIL_IN_TEXT.search(listing.description)
    email = found.group(0) if found else None
    return OpportunityDetail(
        id=listing.id,
        type=listing.type,
        title=listing.title,
        organization=listing.organization,
        location=listing.location,
        country_code=listing.country_code,
        work_arrangement=listing.work_arrangement,
        match_score=match.score,
        deadline=listing.deadline,
        sponsorship=sponsorship_evidence(listing, config).value,
        has_hard_failure=match.has_hard_failure,
        description=listing.description,
        match_factors=match.factors,
        requirements=match.requirements,
        source=SourceRef(name=source_name(source.source_id), url=source.url, checked_at=listing.last_checked_at),
        circular=ArchivedCircular(archived_at=original.observed_at, original_url=source.url, text=original.text),
        route=ApplicationRoute.EMAIL.value if email else config.default_route,
        application_email=email,
    )
