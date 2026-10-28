from dataclasses import dataclass, field
from typing import Any

import anthropic
import httpx
import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.models import OpportunityMatch, Profile, ProfileEntry, Track
from careerpilot.discovery.models import CircularVersion, Listing, ListingSource, WarningSign
from careerpilot.matching.claude import AssessedFactor, AssessedRequirement, Assessment, ClaudeMatcher
from careerpilot.matching.rules import RuleBasedMatcher, is_eligible
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.config import MatchingConfig, load_settings
from careerpilot.platform.enums import ApplicationMode, OpportunityStatus, RequirementCheck, SponsorshipEvidence
from tests.unit.conftest import DEMO_USER

AT = "2026-10-20T06:00:00.000Z"


@pytest.fixture
def config() -> MatchingConfig:
    return load_settings("local").matching


def profile() -> Profile:
    return Profile(
        id="prf_1",
        full_name="Ayesha Rahman",
        headline="Frontend engineer",
        completeness=80,
        contacts=[],
        sections={
            "experience": [
                ProfileEntry(
                    id="ex_1",
                    position=1,
                    values={"title": "Frontend Engineer", "organization": "Lumen", "start": "2022-03", "summary": "Design systems"},
                    updated_at=AT,
                )
            ]
        },
        skills=["React", "TypeScript", "Next.js", "PostgreSQL"],
        documents=[],
    )


def track(kind: str) -> Track:
    return Track(id=f"trk_{kind}", kind=kind, result_count=3, mode=ApplicationMode.APPROVE_EACH, position=1)


def listing(**changes: Any) -> Listing:
    base = Listing(
        id="opp_1",
        fingerprint="f",
        type="job",
        title="Senior Frontend Engineer",
        organization="Northwind Labs",
        location="Remote",
        country_code="",
        work_arrangement="remote",
        description="Lead our React and Next.js front end.",
        status=OpportunityStatus.ACTIVE,
        warnings=[],
        sources=[ListingSource(source_id="src_remote_board", url="https://jobs.example/1", first_seen_at=AT, last_seen_at=AT)],
        versions=[CircularVersion(observed_at=AT, content_hash="h", text="Lead our React and Next.js front end.")],
        discovered_at=AT,
        last_checked_at=AT,
    )
    return base.model_copy(update=changes)


def test_rules_reward_similar_titles_and_profile_skills(config: MatchingConfig, clock: FixedClock) -> None:
    matcher = RuleBasedMatcher(config, clock)
    strong = matcher.assess(profile(), track("remote"), listing())
    weak = matcher.assess(profile(), track("remote"), listing(title="Warehouse Supervisor", description="Manage stock levels."))
    assert strong.score > weak.score
    assert strong.score >= config.min_score > weak.score
    assert any("React, Next.js" in f.text and f.positive for f in strong.factors)
    assert any("Frontend Engineer" in f.text for f in strong.factors)
    assert any(not f.positive for f in weak.factors)
    assert strong.matcher == config.rules_version


def test_rules_mark_unavailable_sponsorship_as_hard_failure(config: MatchingConfig, clock: FixedClock) -> None:
    matcher = RuleBasedMatcher(config, clock)
    intl = track("international_sponsored")
    refused = matcher.assess(profile(), intl, listing(description="React role. Visa sponsorship is not available."))
    offered = matcher.assess(profile(), intl, listing(description="React role with visa sponsorship for the right person."))
    silent = matcher.assess(profile(), intl, listing())
    assert (refused.has_hard_failure, refused.requirements[0].check) == (True, RequirementCheck.NOT_MET.value)
    assert (offered.has_hard_failure, offered.requirements[0].check) == (False, RequirementCheck.MET.value)
    assert silent.requirements[0].check == RequirementCheck.UNKNOWN.value
    assert matcher.assess(profile(), track("remote"), listing()).requirements == []


def test_tracks_only_take_eligible_listings(config: MatchingConfig) -> None:
    assert is_eligible(listing(), track("remote"), config)
    assert not is_eligible(listing(work_arrangement="onsite"), track("remote"), config)
    assert is_eligible(listing(country_code="BD", work_arrangement="hybrid"), track("bangladesh_onsite"), config, "BD")
    assert not is_eligible(listing(country_code="BD"), track("international_sponsored"), config, "BD")
    assert not is_eligible(listing(), track("bangladesh_government"), config)
    singapore_onsite = listing(country_code="SG", work_arrangement="onsite")
    assert is_eligible(singapore_onsite, track("bangladesh_onsite"), config, "SG")
    assert not is_eligible(singapore_onsite, track("bangladesh_onsite"), config, "BD")
    assert not is_eligible(singapore_onsite, track("international_sponsored"), config, "SG")
    flagged = listing(status=OpportunityStatus.FLAGGED, warnings=[WarningSign.UPFRONT_FEE])
    assert not is_eligible(flagged, track("remote"), config)
    assert is_eligible(flagged, track("remote"), config.model_copy(update={"include_flagged": True}))


@dataclass
class FakeResponse:
    stop_reason: str | None
    parsed_output: Assessment | None


@dataclass
class FakeMessages:
    response: FakeResponse | None = None
    error: Exception | None = None
    calls: list[dict[str, Any]] = field(default_factory=list[dict[str, Any]])

    def parse(self, **kwargs: Any) -> FakeResponse:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        assert self.response is not None
        return self.response


@dataclass
class FakeClient:
    messages: FakeMessages


class FixedMatcher:
    def assess(self, profile: Profile, track: Track, listing: Listing) -> OpportunityMatch:
        return OpportunityMatch(score=1, factors=[], requirements=[], has_hard_failure=False, matcher="fallback", matched_at=AT)


ASSESSMENT = Assessment(
    score=140,
    factors=[AssessedFactor(text="Strong React background", positive=True)],
    requirements=[AssessedRequirement(text="5 years of React", check=RequirementCheck.MET, hard=True)],
    hard_failure=False,
)


def claude(config: MatchingConfig, clock: FixedClock, messages: FakeMessages) -> ClaudeMatcher:
    return ClaudeMatcher(config, clock, FakeClient(messages), FixedMatcher())  # type: ignore[arg-type]


def test_claude_matcher_maps_structured_assessment(config: MatchingConfig, clock: FixedClock) -> None:
    messages = FakeMessages(response=FakeResponse(stop_reason="end_turn", parsed_output=ASSESSMENT))
    match = claude(config, clock, messages).assess(profile(), track("remote"), listing())
    assert match.score == 100
    assert match.matcher == config.model
    assert match.requirements[0].check == RequirementCheck.MET.value
    call = messages.calls[0]
    assert call["model"] == config.model
    assert call["output_config"] == {"effort": config.effort}
    assert call["output_format"] is Assessment
    prompt = call["messages"][0]["content"]
    assert "Next.js" in prompt and "Northwind Labs" in prompt and "Remote jobs" in prompt


def test_claude_matcher_falls_back_on_refusal_and_errors(config: MatchingConfig, clock: FixedClock) -> None:
    refused = FakeMessages(response=FakeResponse(stop_reason="refusal", parsed_output=None))
    assert claude(config, clock, refused).assess(profile(), track("remote"), listing()).matcher == "fallback"
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    failures: list[Exception] = [
        anthropic.APIConnectionError(request=request),
        anthropic.RateLimitError("slow down", response=httpx.Response(429, request=request), body=None),
        anthropic.InternalServerError("oops", response=httpx.Response(500, request=request), body=None),
    ]
    for failure in failures:
        assert claude(config, clock, FakeMessages(error=failure)).assess(profile(), track("remote"), listing()).matcher == "fallback"


def test_discovered_listings_become_personal_recommendations(container: Container) -> None:
    discovered = {item.id: item for item in container.discovery.listings()}
    shown = [o for digest in container.dashboard.get(DEMO_USER).tracks for o in digest.opportunities if o.id in discovered]
    titles = {discovered[o.id].title for o in shown}
    assert "Senior Backend Engineer (Python)" in titles
    assert "Senior Frontend Engineer" not in titles
    assert "Data Entry Operator (work from home)" not in titles
    for summary in shown:
        detail = container.opportunities.detail(DEMO_USER, summary.id)
        assert detail.match_score == summary.match_score >= container.settings.matching.min_score
        assert detail.sponsorship in {e.value for e in SponsorshipEvidence}
        assert detail.circular.text
    assert container.recommendations.refresh(DEMO_USER) == 0
