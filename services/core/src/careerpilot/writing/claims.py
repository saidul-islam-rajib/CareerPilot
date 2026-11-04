import re

from careerpilot.candidate.models import OpportunityDetail
from careerpilot.matching.skills import SkillCatalog
from careerpilot.platform.phrases import phrase_key
from careerpilot.writing.config import ChecksConfig
from careerpilot.writing.enums import IssueKind
from careerpilot.writing.facts import SKILL_PREFIX, facts_text, normalise, words_of
from careerpilot.writing.models import CheckIssue, Fact

SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|\n+")
LEADING_MARKS = re.compile(r"^[\s\-*•\d.)]+")
NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
CAPITALISED = re.compile(r"\b[A-Z][A-Za-z]+\b")
WORD = re.compile(r"\w+", re.UNICODE)


def split_sentences(text: str) -> list[str]:
    parts = (LEADING_MARKS.sub("", part).strip() for part in SENTENCE_BREAK.split(text))
    return [part for part in parts if part]


def numbers_of(text: str) -> set[str]:
    return set(NUMBER.findall(text))


def term_pattern(term: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(normalise(term))}(?!\w)")


class ClaimChecker:
    def __init__(self, config: ChecksConfig, skills: SkillCatalog, allowed_words: frozenset[str]) -> None:
        self._first_person = frozenset(config.first_person)
        self._claim_terms = [(term, term_pattern(term)) for term in config.claim_terms]
        self._neutral = frozenset(config.neutral_words) | allowed_words
        self._skills = skills

    def check(self, text: str, facts: list[Fact], opportunity: OpportunityDetail) -> list[CheckIssue]:
        fact_text = facts_text(facts)
        fact_words = words_of(fact_text)
        fact_numbers = numbers_of(fact_text)
        listed = [f.text for f in facts if f.id.startswith(SKILL_PREFIX)]
        known_skills = self._skills.known(listed) | {hit.name for hit in self._skills.find(fact_text)}
        opportunity_text = " ".join([opportunity.title, opportunity.organization, opportunity.description])
        context = fact_words | words_of(opportunity_text) | self._neutral
        issues: list[CheckIssue] = []
        for sentence in split_sentences(text):
            lowered = normalise(sentence)
            personal = bool(self._first_person & set(WORD.findall(lowered)))
            unsupported = [
                *self._numbers(sentence, fact_numbers, numbers_of(opportunity_text), personal),
                *self._proper_nouns(sentence, context),
                *self._skill_terms(sentence, known_skills),
                *self._claim_words(lowered, normalise(fact_text)),
            ]
            if unsupported:
                issues.append(CheckIssue(kind=IssueKind.UNSUPPORTED_CLAIM, text=sentence, terms=list(dict.fromkeys(unsupported))))
        return issues

    def _numbers(self, sentence: str, fact_numbers: set[str], opportunity_numbers: set[str], personal: bool) -> list[str]:
        allowed = fact_numbers if personal else fact_numbers | opportunity_numbers
        return [number for number in NUMBER.findall(sentence) if number not in allowed]

    def _proper_nouns(self, sentence: str, context: set[str]) -> list[str]:
        first = WORD.search(sentence)
        start = first.end() if first else 0
        return [word for word in CAPITALISED.findall(sentence[start:]) if normalise(word) not in context]

    def _skill_terms(self, sentence: str, known: set[str]) -> list[str]:
        return [hit.name for hit in self._skills.find(sentence) if hit.name not in known and phrase_key(hit.name) not in known]

    def _claim_words(self, lowered: str, normalised_facts: str) -> list[str]:
        return [term for term, pattern in self._claim_terms if pattern.search(lowered) and not pattern.search(normalised_facts)]
