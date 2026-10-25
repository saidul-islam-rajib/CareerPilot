from careerpilot.candidate.models import MatchFactor, OpportunityMatch, Profile, RequirementItem, Track
from careerpilot.discovery.models import Listing
from careerpilot.discovery.text import normalized
from careerpilot.platform.clock import Clock, iso
from careerpilot.platform.config import MatchingConfig, TrackRule
from careerpilot.platform.enums import OpportunityStatus, RequirementCheck, SponsorshipEvidence
from careerpilot.platform.messages import translate

MAX_SCORE = 100
EXPERIENCE_SECTION = "experience"
EXPERIENCE_TITLE = "title"
LIST_SEPARATOR = ", "


def _mentions(listing: Listing, phrases: list[str]) -> bool:
    text = normalized(listing.description)
    return any(normalized(p) in text for p in phrases)


def sponsorship_unavailable(listing: Listing, config: MatchingConfig) -> bool:
    return _mentions(listing, config.sponsorship.negative)


def sponsorship_evidence(listing: Listing, config: MatchingConfig) -> SponsorshipEvidence:
    offered = _mentions(listing, config.sponsorship.positive) and not sponsorship_unavailable(listing, config)
    return SponsorshipEvidence.STATED if offered else SponsorshipEvidence.NOT_STATED


def track_rule(config: MatchingConfig, track: Track) -> TrackRule:
    return config.track_rules.get(track.kind, TrackRule())


def is_eligible(listing: Listing, track: Track, config: MatchingConfig) -> bool:
    rule = track_rule(config, track)
    if listing.status is not OpportunityStatus.ACTIVE and not (config.include_flagged and listing.status is OpportunityStatus.FLAGGED):
        return False
    checks = [
        not rule.work_arrangements or listing.work_arrangement in rule.work_arrangements,
        not rule.country_codes or listing.country_code in rule.country_codes,
        not rule.exclude_country_codes or listing.country_code not in rule.exclude_country_codes,
        not rule.types or listing.type in rule.types,
    ]
    return all(checks)


class RuleBasedMatcher:
    def __init__(self, config: MatchingConfig, clock: Clock) -> None:
        self._config = config
        self._clock = clock

    def assess(self, profile: Profile, track: Track, listing: Listing) -> OpportunityMatch:
        weights = self._config.weights
        factors: list[MatchFactor] = []
        score = weights.base
        title_score, title = self._best_title(profile, listing)
        if title:
            score += round(weights.title * title_score)
            factors.append(MatchFactor(text=translate("matching.titleMatch", {"title": title}), positive=True))
        skills = self._matched_skills(profile, listing)
        if skills:
            score += weights.skill * min(len(skills), weights.max_skills)
            factors.append(MatchFactor(text=translate("matching.skillsMatch", {"skills": LIST_SEPARATOR.join(skills)}), positive=True))
        else:
            factors.append(MatchFactor(text=translate("matching.noSkills"), positive=False))
        if track_rule(self._config, track).work_arrangements:
            score += weights.arrangement
            factors.append(MatchFactor(text=translate("matching.arrangementMatch"), positive=True))
        requirements, hard_failure = self._sponsorship(track, listing, factors)
        return OpportunityMatch(
            score=min(MAX_SCORE, score),
            factors=factors,
            requirements=requirements,
            has_hard_failure=hard_failure,
            matcher=self._config.rules_version,
            matched_at=iso(self._clock.now()),
        )

    @staticmethod
    def _best_title(profile: Profile, listing: Listing) -> tuple[float, str]:
        wanted = set(normalized(listing.title).split())
        best: tuple[float, str] = (0.0, "")
        for experience in profile.active_entries(EXPERIENCE_SECTION):
            title = experience.text(EXPERIENCE_TITLE)
            words = set(normalized(title).split())
            overlap = len(words & wanted) / len(words | wanted) if words | wanted else 0.0
            if overlap > best[0]:
                best = (overlap, title)
        return best

    @staticmethod
    def _matched_skills(profile: Profile, listing: Listing) -> list[str]:
        text = f" {normalized(f'{listing.title} {listing.description}')} "
        return [skill for skill in profile.skills if f" {normalized(skill)} " in text]

    def _sponsorship(self, track: Track, listing: Listing, factors: list[MatchFactor]) -> tuple[list[RequirementItem], bool]:
        unavailable = sponsorship_unavailable(listing, self._config)
        offered = sponsorship_evidence(listing, self._config) is SponsorshipEvidence.STATED
        if offered:
            factors.append(MatchFactor(text=translate("matching.sponsorshipStated"), positive=True))
        if unavailable:
            factors.append(MatchFactor(text=translate("matching.sponsorshipUnavailable"), positive=False))
        if not track_rule(self._config, track).require_sponsorship:
            return [], False
        check = RequirementCheck.NOT_MET if unavailable else RequirementCheck.MET if offered else RequirementCheck.UNKNOWN
        requirement = RequirementItem(text=translate("matching.requirementSponsorship"), check=check.value, hard=True)
        return [requirement], check is RequirementCheck.NOT_MET
