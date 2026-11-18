from careerpilot.candidate.models import MatchFactor, MatchFeedback, OpportunityMatch
from careerpilot.discovery.models import Listing
from careerpilot.discovery.text import normalized
from careerpilot.platform.config import FeedbackConfig
from careerpilot.platform.enums import FeedbackVerdict
from careerpilot.platform.messages import translate

MAX_SCORE = 100
MIN_SCORE = 0


def _similarity(listing: Listing, entry: MatchFeedback, config: FeedbackConfig) -> float:
    words = set(normalized(listing.title).split())
    other = set(normalized(entry.title).split())
    overlap = len(words & other) / len(words | other) if words | other else 0.0
    same_organization = normalized(listing.organization) == normalized(entry.organization)
    return max(overlap, config.same_organization_similarity if same_organization else 0.0)


def _sign(entry: MatchFeedback) -> int:
    return 1 if entry.verdict is FeedbackVerdict.GOOD_MATCH else -1


def feedback_shift(listing: Listing, entries: list[MatchFeedback], config: FeedbackConfig) -> int:
    total = 0.0
    for entry in entries:
        if entry.opportunity_id == listing.id:
            continue
        similarity = _similarity(listing, entry, config)
        if similarity >= config.min_similarity:
            total += _sign(entry) * similarity * config.weight
    return max(-config.max_shift, min(config.max_shift, round(total)))


def with_feedback(match: OpportunityMatch, listing: Listing, entries: list[MatchFeedback], config: FeedbackConfig) -> OpportunityMatch:
    shift = feedback_shift(listing, entries, config)
    if shift == 0:
        return match
    key = "matching.feedbackPositive" if shift > 0 else "matching.feedbackNegative"
    return match.model_copy(
        update={
            "score": max(MIN_SCORE, min(MAX_SCORE, match.score + shift)),
            "factors": [*match.factors, MatchFactor(text=translate(key), positive=shift > 0)],
        }
    )
