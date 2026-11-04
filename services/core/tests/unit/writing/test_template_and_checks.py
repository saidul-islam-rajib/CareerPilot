import pytest

from careerpilot.bootstrap import Container
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.writing.enums import DraftSource, DraftStatus, IssueKind, WritingFailure, WritingKind, WritingTone
from careerpilot.writing.models import WritingDraft
from careerpilot.writing.service import GenerateInput
from tests.unit.writing.conftest import OPPORTUNITY, USER

OVER_LIMIT_FILLER = "words " * 500
TOO_LONG = "x" * 20001
TOO_MANY_INSTRUCTIONS = "x" * 1001


def cover_letter(container: Container, **extra: object) -> WritingDraft:
    return create(container, WritingKind.COVER_LETTER, **extra)


def create(container: Container, kind: WritingKind, **extra: object) -> WritingDraft:
    tone = extra.get("tone")
    words = extra.get("max_words")
    return container.writing.generate(
        USER,
        GenerateInput(
            kind=kind,
            opportunity_id=OPPORTUNITY,
            tone=tone if isinstance(tone, WritingTone) else None,
            max_words=words if isinstance(words, int) else None,
            instructions=str(extra.get("instructions", "")),
        ),
    )


def kinds(draft: WritingDraft) -> set[IssueKind]:
    return {issue.kind for issue in draft.issues}


def test_template_cover_letter_uses_only_profile_facts_and_passes_the_checks(container: Container) -> None:
    draft = cover_letter(container)
    assert draft.source is DraftSource.TEMPLATE
    assert draft.model is None
    assert draft.status is DraftStatus.READY
    assert draft.issues == []
    assert "Northwind Labs" in draft.text
    assert "Senior Frontend Engineer" in draft.text
    assert "Lumen Health" in draft.text
    assert "Ayesha Rahman" in draft.text
    assert {fact.id for fact in draft.facts_used} >= {"name", "ex_lumen"}


def test_template_cover_letter_respects_the_word_limit_and_tone(container: Container) -> None:
    full = cover_letter(container)
    short = cover_letter(container, max_words=60, tone=WritingTone.CONCISE)
    assert short.word_count < full.word_count
    assert short.text.startswith("Dear Northwind Labs team,")
    friendly = cover_letter(container, tone=WritingTone.FRIENDLY)
    assert friendly.text.startswith("Hello Northwind Labs team,")
    assert "Warm regards," in friendly.text


def test_template_cv_has_standard_headings_and_only_real_facts(container: Container) -> None:
    draft = create(container, WritingKind.TAILORED_CV)
    assert draft.status is DraftStatus.READY
    for heading in ("Summary", "Skills", "Experience", "Education", "Certifications", "Languages"):
        assert f"\n{heading}\n" in draft.text
    assert "Frontend Engineer, Lumen Health (2022-03 - present)" in draft.text
    assert "Riverstone Software" in draft.text
    assert draft.text.index("Lumen Health") < draft.text.index("Riverstone Software")


def test_essays_and_statements_need_ai_when_it_is_not_configured(container: Container) -> None:
    for kind in (WritingKind.ESSAY, WritingKind.STATEMENT):
        with pytest.raises(DomainError) as error:
            create(container, kind)
        assert error.value.code is ErrorCode.SERVICE_UNAVAILABLE
        assert error.value.detail == WritingFailure.AI_NOT_CONFIGURED.value


def test_status_says_ai_is_not_configured(container: Container) -> None:
    status = container.writing.status()
    assert status.ai_configured is False
    assert status.model is None
    available = {item.kind: item.available for item in status.kinds}
    assert available == {
        WritingKind.COVER_LETTER: True,
        WritingKind.TAILORED_CV: True,
        WritingKind.ESSAY: False,
        WritingKind.STATEMENT: False,
    }


def test_claim_check_flags_invented_numbers_employers_skills_and_credentials(container: Container) -> None:
    draft = cover_letter(container)
    edited = container.writing.edit(
        USER,
        draft.id,
        "Dear Northwind Labs hiring team, I led a team of 12 engineers at Google using Kubernetes and I hold a PhD. "
        "I currently work as Frontend Engineer at Lumen Health.",
    )
    assert edited.status is DraftStatus.NEEDS_FIXES
    assert edited.source is DraftSource.USER
    flagged = [issue for issue in edited.issues if issue.kind is IssueKind.UNSUPPORTED_CLAIM]
    assert len(flagged) == 1
    assert {"12", "Google", "Kubernetes", "phd"} <= set(flagged[0].terms)
    assert "Lumen Health" not in flagged[0].text


def test_claim_check_accepts_what_the_profile_states(container: Container) -> None:
    draft = cover_letter(container)
    edited = container.writing.edit(
        USER, draft.id, "Dear Northwind Labs hiring team, I led the design system used by six product teams at Lumen Health with React."
    )
    assert edited.issues == []


def test_cross_contamination_flags_other_employers_but_not_the_users_own(container: Container) -> None:
    draft = cover_letter(container)
    edited = container.writing.edit(
        USER, draft.id, "Dear Kite Commerce hiring team, I am applying to Northwind Labs and worked at Riverstone Software."
    )
    contamination = [i for i in edited.issues if i.kind is IssueKind.OTHER_EMPLOYER]
    assert [i.terms for i in contamination] == [["Kite Commerce"]]
    assert edited.status is DraftStatus.NEEDS_FIXES


def test_other_employer_emails_are_flagged(container: Container) -> None:
    draft = cover_letter(container)
    edited = container.writing.edit(USER, draft.id, "Northwind Labs hiring team, write to jobs@harbourline.example.com.")
    assert IssueKind.OTHER_EMPLOYER in kinds(edited)


def test_placeholders_missing_target_and_over_limit_are_flagged(container: Container) -> None:
    draft = cover_letter(container)
    placeholder = container.writing.edit(USER, draft.id, "Dear [Company], I am Ayesha Rahman. TODO finish.")
    assert {IssueKind.PLACEHOLDER, IssueKind.MISSING_TARGET} <= kinds(placeholder)
    assert IssueKind.OVER_LIMIT in kinds(container.writing.edit(USER, draft.id, f"Northwind Labs {OVER_LIMIT_FILLER}"))


def test_text_is_required_and_bounded(container: Container) -> None:
    draft = cover_letter(container)
    for bad in ("   ", TOO_LONG):
        with pytest.raises(DomainError) as error:
            container.writing.edit(USER, draft.id, bad)
        assert error.value.detail == WritingFailure.TEXT.value


def test_instructions_are_bounded(container: Container) -> None:
    with pytest.raises(DomainError) as error:
        cover_letter(container, instructions=TOO_MANY_INSTRUCTIONS)
    assert error.value.detail == WritingFailure.INSTRUCTIONS.value
