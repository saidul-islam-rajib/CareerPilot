import re

from careerpilot.matching.skills import SkillCatalog
from careerpilot.writing.claims import ClaimChecker
from careerpilot.writing.config import WritingConfig
from careerpilot.writing.contamination import ContaminationChecker, name_pattern
from careerpilot.writing.enums import IssueKind
from careerpilot.writing.facts import normalise
from careerpilot.writing.models import CheckIssue, CheckReport, CheckSubject, Fact, FactRef

WORD = re.compile(r"\S+")


def word_count(text: str) -> int:
    return len(WORD.findall(text))


def facts_used(text: str, facts: list[Fact]) -> list[FactRef]:
    lowered = normalise(text)
    return [FactRef(id=f.id, label=f.label) for f in facts if any(normalise(anchor) in lowered for anchor in f.anchors)]


class WritingChecker:
    def __init__(self, config: WritingConfig, skills: SkillCatalog, heading_words: frozenset[str]) -> None:
        self._config = config
        self._placeholders = [re.compile(pattern) for pattern in config.checks.placeholder_patterns]
        self._claims = ClaimChecker(config.checks, skills, heading_words)
        self._contamination = ContaminationChecker(config.checks)

    def check(self, subject: CheckSubject) -> CheckReport:
        rule = self._config.kind_rule(subject.kind)
        if not subject.text.strip():
            return CheckReport(issues=[CheckIssue(kind=IssueKind.EMPTY)], facts_used=[])
        issues = [
            *self._placeholder_issues(subject.text),
            *self._contamination.check(subject.text, subject.other_employers),
            *self._claims.check(subject.text, subject.facts, subject.opportunity),
        ]
        if rule.require_target_mention and name_pattern(subject.opportunity.organization).search(normalise(subject.text)) is None:
            issues.append(CheckIssue(kind=IssueKind.MISSING_TARGET, terms=[subject.opportunity.organization]))
        count = word_count(subject.text)
        if count > rule.max_words:
            issues.append(CheckIssue(kind=IssueKind.OVER_LIMIT, terms=[str(count), str(rule.max_words)]))
        return CheckReport(issues=issues, facts_used=facts_used(subject.text, subject.facts))

    def _placeholder_issues(self, text: str) -> list[CheckIssue]:
        found = [match.group(0) for pattern in self._placeholders for match in pattern.finditer(text)]
        return [CheckIssue(kind=IssueKind.PLACEHOLDER, terms=list(dict.fromkeys(found)))] if found else []
