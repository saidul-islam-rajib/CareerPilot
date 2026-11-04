from careerpilot.candidate.models import EntryValue, OpportunityDetail, Profile, ProfileEntry
from careerpilot.platform.messages import translate
from careerpilot.writing.checks import word_count
from careerpilot.writing.config import CvSection, TemplateConfig, WritingConfig
from careerpilot.writing.enums import DraftSource, WritingKind, WritingTone
from careerpilot.writing.facts import entry_text, words_of
from careerpilot.writing.models import Generated, WritingRequest

TEMPLATES = "writing.templates"
HEADINGS = "writing.headings"
PARAGRAPH = "\n\n"
LINE = "\n"
LIST_SEPARATOR = ", "
DATE_SEPARATOR = " - "
DETAIL_OPEN = " ("
DETAIL_CLOSE = ")"
SENTENCE_SEPARATOR = " "


def value_text(values: dict[str, EntryValue], key: str) -> str:
    value = values.get(key)
    return "" if value in (None, "", False) else str(value)


def relevance(entry: ProfileEntry, wanted: set[str], minimum: int) -> int:
    return len({w for w in words_of(entry_text(entry.values)) if len(w) >= minimum} & wanted)


def wanted_words(opportunity: OpportunityDetail, minimum: int) -> set[str]:
    return {w for w in words_of(f"{opportunity.title} {opportunity.description}") if len(w) >= minimum}


def ranked(entries: list[ProfileEntry], wanted: set[str], minimum: int) -> list[ProfileEntry]:
    return sorted(entries, key=lambda e: (-relevance(e, wanted, minimum), e.position))


def ranked_skills(skills: list[str], wanted: set[str]) -> list[str]:
    order = {skill: index for index, skill in enumerate(skills)}
    return sorted(skills, key=lambda s: (-len(words_of(s) & wanted), order[s]))


def tone_text(group: str, tone: WritingTone, params: dict[str, str | int]) -> str:
    return translate(f"{TEMPLATES}.{group}.{tone.value}", params)


class TemplateWriter:
    def __init__(self, config: WritingConfig) -> None:
        self._rules = config
        self._template: TemplateConfig = config.template

    @property
    def model(self) -> str | None:
        return None

    def supports(self, kind: WritingKind) -> bool:
        return not self._rules.kind_rule(kind).ai_only

    def generate(self, request: WritingRequest) -> Generated:
        text = self._cover_letter(request) if request.kind is WritingKind.COVER_LETTER else self._cv(request)
        return Generated(text=text, source=DraftSource.TEMPLATE)

    def _cover_letter(self, request: WritingRequest) -> str:
        profile, opportunity, tone = request.profile, request.opportunity, request.tone
        params: dict[str, str | int] = {"organization": opportunity.organization, "title": opportunity.title}
        minimum = self._template.min_word_length
        wanted = wanted_words(opportunity, minimum)
        required = [
            tone_text("greeting", tone, params),
            translate(f"{TEMPLATES}.opening", params),
        ]
        optional = [
            *self._experience_parts(profile, wanted),
            *self._education_parts(profile),
            *self._skills_parts(profile, wanted),
            *self._headline_parts(profile, tone),
        ]
        closing = [translate(f"{TEMPLATES}.closing", params), tone_text("signOff", tone, params), profile.full_name]
        return self._fit(required, optional, closing, request.max_words)

    def _fit(self, required: list[str], optional: list[str], closing: list[str], max_words: int) -> str:
        kept = list(optional)
        while True:
            text = PARAGRAPH.join([*required, *kept, LINE.join(closing[:1]), LINE.join(closing[1:])])
            if word_count(text) <= max_words or not kept:
                return text
            kept.pop()

    def _experience_parts(self, profile: Profile, wanted: set[str]) -> list[str]:
        fields = self._template.experience
        entries = ranked(profile.active_entries(fields.section), wanted, self._template.min_word_length)
        parts: list[str] = []
        for entry in entries[: self._template.entries]:
            values = entry.values
            role = {"title": value_text(values, fields.title), "organization": value_text(values, fields.organization)}
            key = "currentRole" if value_text(values, fields.ongoing) else "pastRole"
            sentences = [translate(f"{TEMPLATES}.{key}", role), value_text(values, fields.summary)]
            parts.append(SENTENCE_SEPARATOR.join(s for s in sentences if s))
        return parts

    def _education_parts(self, profile: Profile) -> list[str]:
        fields = self._template.education
        entries = profile.active_entries(fields.section)
        if not entries:
            return []
        values = entries[0].values
        params: dict[str, str | int] = {"degree": value_text(values, fields.degree), "institution": value_text(values, fields.institution)}
        return [translate(f"{TEMPLATES}.education", params)]

    def _skills_parts(self, profile: Profile, wanted: set[str]) -> list[str]:
        if not profile.skills:
            return []
        chosen = ranked_skills(profile.skills, wanted)[: self._template.skills]
        return [translate(f"{TEMPLATES}.skills", {"skills": LIST_SEPARATOR.join(chosen)})]

    def _headline_parts(self, profile: Profile, tone: WritingTone) -> list[str]:
        if tone is WritingTone.CONCISE or not profile.headline.strip():
            return []
        return [translate(f"{TEMPLATES}.headline", {"headline": profile.headline})]

    def _cv(self, request: WritingRequest) -> str:
        profile = request.profile
        wanted = wanted_words(request.opportunity, self._template.min_word_length)
        head = [profile.full_name, *([profile.headline] if profile.headline.strip() else [])]
        blocks = [LINE.join(head)]
        if profile.summary.strip():
            blocks.append(self._block(translate(f"{HEADINGS}.summary"), [profile.summary]))
        if profile.skills:
            skills = ranked_skills(profile.skills, wanted)
            blocks.append(self._block(translate(f"{HEADINGS}.skills"), [LIST_SEPARATOR.join(skills)]))
        for section in self._template.cv_sections:
            entries = ranked(profile.active_entries(section.section), wanted, self._template.min_word_length)
            if entries:
                blocks.append(self._block(translate(f"{HEADINGS}.{section.heading}"), [self._entry_lines(section, e) for e in entries]))
        return PARAGRAPH.join(blocks)

    def _block(self, heading: str, lines: list[str]) -> str:
        return LINE.join([heading, *lines])

    def _entry_lines(self, section: CvSection, entry: ProfileEntry) -> str:
        values = entry.values
        title = LIST_SEPARATOR.join(t for t in (value_text(values, f) for f in section.title_fields) if t)
        dates = [value_text(values, f) for f in section.detail_fields]
        if section.ongoing_field and value_text(values, section.ongoing_field):
            dates = [d for d in dates[:-1] if d] + [translate(f"{TEMPLATES}.present")]
        detail = DATE_SEPARATOR.join(d for d in dates if d)
        heading_line = f"{title}{DETAIL_OPEN}{detail}{DETAIL_CLOSE}" if detail else title
        body = value_text(values, section.body_field) if section.body_field else ""
        return LINE.join(line for line in (heading_line, body) if line)
