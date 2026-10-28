from collections.abc import Callable
from dataclasses import dataclass, field

from careerpilot.candidate.models import ArchivedCircular, OpportunityDetail, OpportunityMatch, SourceRef, Track
from careerpilot.candidate.ports import AccountRepository, CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.discovery.models import Listing
from careerpilot.matching.ports import Matcher
from careerpilot.matching.rules import is_eligible, sponsorship_evidence
from careerpilot.platform.config import ApplicationEmailConfig, MatchingConfig
from careerpilot.platform.enums import ApplicationMode, ApplicationRoute, OpportunityDecision
from careerpilot.platform.validation import EMAIL_IN_TEXT


@dataclass
class RematchState:
    listings: list[Listing]
    listed: set[str]
    acted_on: set[str]
    placed: set[str] = field(default_factory=set[str])


@dataclass(frozen=True)
class RecommendationContext:
    config: MatchingConfig
    matcher: Matcher
    listings: Callable[[str], list[Listing]]
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
        listings = self._ctx.listings(user_id)
        assessed_before = len(workspace.matches)
        added = sum(self._refresh_track(workspace, track, listings) for track in workspace.preferences.tracks)
        if added or len(workspace.matches) != assessed_before:
            self._ctx.workspaces.save(user_id, workspace)
        self._sync_routes(workspace, listings)
        self._apply_automatic(user_id, workspace)
        return added

    def _sync_routes(self, workspace: CandidateWorkspace, listings: list[Listing]) -> None:
        listed = {oid for ids in workspace.track_opportunities.values() for oid in ids}
        for listing in listings:
            current = self._ctx.opportunities.get(listing.id) if listing.id in listed else None
            if current is None:
                continue
            route, email = application_route(listing, self._ctx.config)
            if (current.route, current.application_email) != (route, email):
                self._ctx.opportunities.save(current.model_copy(update={"route": route, "application_email": email}))

    def _apply_automatic(self, user_id: str, workspace: CandidateWorkspace) -> None:
        for opportunity_id in automatic_candidates(workspace):
            self._ctx.apply_by_rule(user_id, opportunity_id)

    def _refresh_track(self, workspace: CandidateWorkspace, track: Track, listings: list[Listing]) -> int:
        current = workspace.track_opportunities.get(track.id, [])
        excluded = set(workspace.preferences.excluded_countries)
        candidates = [
            item
            for item in listings
            if item.id not in current
            and item.id not in workspace.matches
            and item.country_code not in excluded
            and is_eligible(item, track, self._ctx.config)
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
        workspace.track_opportunities[track.id] = [*current, *(listing.id for listing, _ in qualified)]
        return len(qualified)

    def rematch(self, user_id: str) -> int:
        workspace = self._ctx.workspaces.get(user_id)
        listings = self._ctx.listings(user_id)
        state = RematchState(listings=listings, listed={item.id for item in listings}, acted_on=acted_on_opportunities(workspace))
        tracks = sorted(workspace.preferences.tracks, key=lambda t: t.position)
        added = sum(self._rebuild_track(workspace, track, state) for track in tracks)
        self._ctx.workspaces.save(user_id, workspace)
        self._sync_routes(workspace, listings)
        self._apply_automatic(user_id, workspace)
        return added

    def _rebuild_track(self, workspace: CandidateWorkspace, track: Track, state: "RematchState") -> int:
        previous = workspace.track_opportunities.get(track.id, [])
        acted_on, placed = state.acted_on, state.placed
        kept = [oid for oid in previous if (oid in acted_on or oid not in state.listed) and oid not in placed]
        taken = acted_on | placed
        excluded = set(workspace.preferences.excluded_countries)
        candidates = [
            item
            for item in state.listings
            if item.id not in taken and item.country_code not in excluded and is_eligible(item, track, self._ctx.config)
        ]
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
        chosen = [*kept, *(listing.id for listing, _ in best)]
        placed.update(chosen)
        workspace.track_opportunities[track.id] = chosen
        return len([oid for oid in chosen if oid not in previous])

    def place(self, user_id: str, listing: Listing) -> str:
        workspace = self._ctx.workspaces.get(user_id)
        listed = {oid for ids in workspace.track_opportunities.values() for oid in ids}
        if listing.id not in listed:
            tracks = sorted(workspace.preferences.tracks, key=lambda t: t.position)
            eligible = [track for track in tracks if is_eligible(listing, track, self._ctx.config)] or tracks[:1]
            assessed = [(track, self._ctx.matcher.assess(workspace.profile, track, listing)) for track in eligible]
            if not assessed:
                return listing.id
            track, match = max(assessed, key=lambda pair: pair[1].score)
            workspace.matches[listing.id] = match
            workspace.track_opportunities[track.id] = [listing.id, *workspace.track_opportunities.get(track.id, [])]
            self._publish(listing, match)
        workspace.decisions[listing.id] = OpportunityDecision.SAVED
        self._ctx.workspaces.save(user_id, workspace)
        return listing.id

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


def application_email(text: str, config: ApplicationEmailConfig) -> str | None:
    lowered = text.lower()
    for found in EMAIL_IN_TEXT.finditer(text):
        local = found.group(0).split("@", 1)[0].lower()
        before = lowered[max(0, found.start() - config.window_chars) : found.start()]
        if any(word in local for word in config.excluded_words):
            continue
        if any(phrase in before for phrase in config.phrases):
            return found.group(0).rstrip(".")
    return None


def automatic_candidates(workspace: CandidateWorkspace) -> list[str]:
    handled = acted_on_opportunities(workspace)
    chosen: list[str] = []
    for track in sorted(workspace.preferences.tracks, key=lambda t: t.position):
        if track.mode is not ApplicationMode.AUTOMATIC:
            continue
        for opportunity_id in workspace.track_opportunities.get(track.id, []):
            match = workspace.matches.get(opportunity_id)
            if opportunity_id not in handled and opportunity_id not in chosen and match is not None and not match.has_hard_failure:
                chosen.append(opportunity_id)
    return chosen


def application_route(listing: Listing, config: MatchingConfig) -> tuple[str, str | None]:
    email = application_email(listing.description, config.application_email)
    return (ApplicationRoute.EMAIL.value if email else config.default_route), email


def opportunity_from_listing(
    listing: Listing, match: OpportunityMatch, source_name: Callable[[str], str], config: MatchingConfig
) -> OpportunityDetail:
    source = listing.sources[0]
    original = listing.versions[0]
    route, email = application_route(listing, config)
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
        route=route,
        application_email=email,
    )
