from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.models import ArchivedCircular, OpportunityDetail, OpportunityMatch, SourceRef, Track
from careerpilot.candidate.ports import AccountRepository, CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.discovery.models import Listing
from careerpilot.matching.ports import Matcher
from careerpilot.matching.rules import is_eligible, sponsorship_evidence
from careerpilot.platform.config import MatchingConfig
from careerpilot.platform.enums import ApplicationMode, ApplicationRoute
from careerpilot.platform.validation import EMAIL_IN_TEXT


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

    def _publish(self, listing: Listing, match: OpportunityMatch) -> None:
        if self._ctx.opportunities.get(listing.id) is not None:
            return
        self._ctx.opportunities.save(opportunity_from_listing(listing, match, self._ctx.source_name, self._ctx.config))


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
