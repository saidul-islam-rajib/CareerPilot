import re

from careerpilot.candidate.models import OpportunityDetail
from careerpilot.platform.phrases import phrase_key
from careerpilot.writing.config import ChecksConfig
from careerpilot.writing.enums import IssueKind
from careerpilot.writing.facts import facts_text, normalise
from careerpilot.writing.models import CheckIssue, Fact

SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|\n+")


def name_pattern(name: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(normalise(name))}(?!\w)")


def other_employer_names(target: OpportunityDetail, others: list[OpportunityDetail], facts: list[Fact]) -> list[str]:
    own = normalise(facts_text(facts))
    target_key = phrase_key(target.organization)
    names: dict[str, str] = {}
    for other in others:
        for name in (other.organization, other.application_email or ""):
            key = phrase_key(name)
            if not key or key in target_key or target_key in key or name_pattern(name).search(own):
                continue
            names.setdefault(key, name)
    return list(names.values())


class ContaminationChecker:
    def __init__(self, config: ChecksConfig) -> None:
        self._min_length = config.min_name_length

    def check(self, text: str, names: list[str]) -> list[CheckIssue]:
        lowered = normalise(text)
        found = [name for name in names if len(name) >= self._min_length and name_pattern(name).search(lowered)]
        sentences = [s.strip() for s in SENTENCE_BREAK.split(text) if s.strip()]
        issues: list[CheckIssue] = []
        for name in found:
            pattern = name_pattern(name)
            where = next((s for s in sentences if pattern.search(normalise(s))), "")
            issues.append(CheckIssue(kind=IssueKind.OTHER_EMPLOYER, text=where, terms=[name]))
        return issues
