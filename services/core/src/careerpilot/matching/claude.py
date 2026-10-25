import logging
from pathlib import Path
from typing import Protocol

import anthropic
from anthropic.types import OutputConfigParam
from pydantic import BaseModel, Field

from careerpilot.candidate.models import MatchFactor, OpportunityMatch, Profile, RequirementItem, Track
from careerpilot.discovery.models import Listing
from careerpilot.matching.ports import Matcher
from careerpilot.platform.clock import Clock, iso
from careerpilot.platform.config import MatchingConfig, repository_root
from careerpilot.platform.enums import RequirementCheck
from careerpilot.platform.messages import translate

REFUSAL = "refusal"
USER_ROLE = "user"
LINE = "\n"
logger = logging.getLogger(__name__)


class AssessedFactor(BaseModel):
    text: str
    positive: bool


class AssessedRequirement(BaseModel):
    text: str
    check: RequirementCheck
    hard: bool


class Assessment(BaseModel):
    score: int = Field(description="0 to 100")
    factors: list[AssessedFactor]
    requirements: list[AssessedRequirement]
    hard_failure: bool


class ParsedResponse(Protocol):
    @property
    def stop_reason(self) -> str | None: ...

    @property
    def parsed_output(self) -> Assessment | None: ...


def profile_text(profile: Profile) -> str:
    lines = [
        f"Headline: {profile.headline}",
        f"Skills: {', '.join(profile.skills)}",
        *(f"Experience: {e.title} at {e.organization} ({e.start} to {e.end or 'present'}). {e.summary}" for e in profile.experience),
        *(f"Education: {e.degree}, {e.institution} ({e.start_year}-{e.end_year or 'present'})" for e in profile.education),
    ]
    return LINE.join(lines)


def listing_text(listing: Listing) -> str:
    return LINE.join(
        [
            f"Title: {listing.title}",
            f"Organization: {listing.organization}",
            f"Location: {listing.location or 'not stated'} ({listing.country_code or 'country not stated'})",
            f"Work arrangement: {listing.work_arrangement}",
            f"Deadline: {listing.deadline or 'not stated'}",
            f"Description: {listing.description}",
        ]
    )


class ClaudeMatcher:
    def __init__(self, config: MatchingConfig, clock: Clock, client: anthropic.Anthropic, fallback: Matcher) -> None:
        self._config = config
        self._clock = clock
        self._client = client
        self._fallback = fallback
        self._prompt = (repository_root() / Path(config.prompt_file)).read_text(encoding="utf-8")

    def assess(self, profile: Profile, track: Track, listing: Listing) -> OpportunityMatch:
        assessment = self._ask(profile, track, listing)
        if assessment is None:
            return self._fallback.assess(profile, track, listing)
        return OpportunityMatch(
            score=max(0, min(100, assessment.score)),
            factors=[MatchFactor(text=f.text, positive=f.positive) for f in assessment.factors],
            requirements=[RequirementItem(text=r.text, check=r.check.value, hard=r.hard) for r in assessment.requirements],
            has_hard_failure=assessment.hard_failure,
            matcher=self._config.model,
            matched_at=iso(self._clock.now()),
        )

    def _ask(self, profile: Profile, track: Track, listing: Listing) -> Assessment | None:
        prompt = self._prompt.format(
            track=track.name or translate(f"matching.trackNames.{track.kind}"),
            profile=profile_text(profile),
            opportunity=listing_text(listing),
        )
        try:
            response: ParsedResponse = self._client.messages.parse(
                model=self._config.model,
                max_tokens=self._config.max_tokens,
                output_config=OutputConfigParam(effort=self._config.effort),
                messages=[{"role": USER_ROLE, "content": prompt}],
                output_format=Assessment,
            )
        except anthropic.RateLimitError:
            logger.warning("matching_rate_limited")
            return None
        except anthropic.APIStatusError as error:
            logger.warning("matching_api_error", extra={"status": error.status_code})
            return None
        except anthropic.APIConnectionError:
            logger.warning("matching_unreachable")
            return None
        if response.stop_reason == REFUSAL:
            logger.warning("matching_refused")
            return None
        return response.parsed_output
