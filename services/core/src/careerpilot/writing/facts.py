import re

from careerpilot.candidate.models import EntryValue, Profile
from careerpilot.writing.models import Fact

NAME_FACT = "name"
HEADLINE_FACT = "headline"
SUMMARY_FACT = "summary"
LOCATION_FACT = "location"
SKILL_PREFIX = "skill:"
FACT_SEPARATOR = "; "
LABEL_SEPARATOR = "_"
DISPLAY_SEPARATOR = " "
ANCHOR_MIN_LENGTH = 3
ANCHOR_MAX_LENGTH = 80
NUMERIC_ONLY = re.compile(r"^[\d\W]+$")
WORDS = re.compile(r"\w+", re.UNICODE)
APOSTROPHES = str.maketrans({"\u2019": "'", "\u2018": "'"})


def normalise(text: str) -> str:
    return text.translate(APOSTROPHES).lower()


def words_of(text: str) -> set[str]:
    return set(WORDS.findall(normalise(text)))


def display(section: str) -> str:
    return section.replace(LABEL_SEPARATOR, DISPLAY_SEPARATOR)


def entry_anchors(values: dict[str, EntryValue]) -> list[str]:
    texts = [str(v) for v in values.values() if isinstance(v, str)]
    return [t for t in texts if ANCHOR_MIN_LENGTH <= len(t) <= ANCHOR_MAX_LENGTH and not NUMERIC_ONLY.match(t)]


def entry_text(values: dict[str, EntryValue]) -> str:
    return FACT_SEPARATOR.join(f"{key}: {value}" for key, value in values.items() if value not in (None, ""))


def build_facts(profile: Profile) -> list[Fact]:
    facts = [Fact(id=NAME_FACT, label=NAME_FACT, text=profile.full_name, anchors=[profile.full_name])]
    optional = [(HEADLINE_FACT, profile.headline), (SUMMARY_FACT, profile.summary), (LOCATION_FACT, profile.location)]
    for fact_id, text in optional:
        if text.strip():
            anchors = [text] if len(text) <= ANCHOR_MAX_LENGTH else []
            facts.append(Fact(id=fact_id, label=fact_id, text=text, anchors=anchors))
    facts.extend(Fact(id=f"{SKILL_PREFIX}{skill}", label=SKILL_PREFIX.rstrip(":"), text=skill, anchors=[skill]) for skill in profile.skills)
    for section in profile.sections:
        for entry in profile.active_entries(section):
            facts.append(Fact(id=entry.id, label=display(section), text=entry_text(entry.values), anchors=entry_anchors(entry.values)))
    return facts


def facts_block(facts: list[Fact]) -> str:
    return "\n".join(f"- [{fact.id}] {fact.label}: {fact.text}" for fact in facts)


def facts_text(facts: list[Fact]) -> str:
    return "\n".join(fact.text for fact in facts)
