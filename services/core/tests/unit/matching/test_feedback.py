import pytest

from careerpilot.candidate.models import MatchFeedback, OpportunityMatch
from careerpilot.discovery.models import CircularVersion, Listing, ListingSource
from careerpilot.matching.feedback import feedback_shift, with_feedback
from careerpilot.platform.config import FeedbackConfig
from careerpilot.platform.enums import FeedbackReason, FeedbackVerdict, OpportunityStatus
from careerpilot.testing import sample_settings

AT = "2026-10-20T06:00:00.000Z"
BASE_SCORE = 60


@pytest.fixture
def config() -> FeedbackConfig:
    return sample_settings().matching.feedback


def listing(listing_id: str, title: str, organization: str) -> Listing:
    return Listing(
        id=listing_id,
        fingerprint=listing_id,
        type="job",
        title=title,
        organization=organization,
        location="Remote",
        country_code="",
        work_arrangement="remote",
        description="",
        status=OpportunityStatus.ACTIVE,
        warnings=[],
        sources=[ListingSource(source_id="s", url="https://jobs.example/1", first_seen_at=AT, last_seen_at=AT)],
        versions=[CircularVersion(observed_at=AT, content_hash="h", text="")],
        discovered_at=AT,
        last_checked_at=AT,
    )


def entry(verdict: FeedbackVerdict, title: str, organization: str = "Other Co") -> MatchFeedback:
    return MatchFeedback(
        opportunity_id="opp_seen",
        verdict=verdict,
        reasons=[FeedbackReason.WRONG_ROLE],
        title=title,
        organization=organization,
        created_at=AT,
    )


def match() -> OpportunityMatch:
    return OpportunityMatch(score=BASE_SCORE, factors=[], requirements=[], has_hard_failure=False, matcher="t", matched_at=AT)


def test_a_good_match_raises_similar_listings_and_not_for_me_lowers_them(config: FeedbackConfig) -> None:
    similar = listing("opp_new", "Senior Frontend Engineer", "Acme")
    liked = [entry(FeedbackVerdict.GOOD_MATCH, "Frontend Engineer")]
    disliked = [entry(FeedbackVerdict.NOT_FOR_ME, "Frontend Engineer")]
    assert with_feedback(match(), similar, liked, config).score > BASE_SCORE
    lowered = with_feedback(match(), similar, disliked, config)
    assert lowered.score < BASE_SCORE
    assert lowered.factors[-1].positive is False


def test_unrelated_listings_and_the_same_listing_are_not_moved(config: FeedbackConfig) -> None:
    unrelated = listing("opp_new", "Warehouse Supervisor", "Acme")
    assert with_feedback(match(), unrelated, [entry(FeedbackVerdict.NOT_FOR_ME, "Frontend Engineer")], config) == match()
    same = listing("opp_seen", "Frontend Engineer", "Other Co")
    assert feedback_shift(same, [entry(FeedbackVerdict.GOOD_MATCH, "Frontend Engineer")], config) == 0


def test_the_shift_is_capped(config: FeedbackConfig) -> None:
    similar = listing("opp_new", "Frontend Engineer", "Other Co")
    many = [entry(FeedbackVerdict.NOT_FOR_ME, "Frontend Engineer") for _ in range(20)]
    assert feedback_shift(similar, many, config) == -config.max_shift
