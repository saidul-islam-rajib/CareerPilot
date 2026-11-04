import pytest

from careerpilot.bootstrap import Container
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.writing.enums import DraftSource, DraftStatus, IssueKind, WritingFailure, WritingKind, WritingProvider
from careerpilot.writing.service import GenerateInput
from tests.unit.writing.conftest import APPROVAL, FAKE_MODEL, OPPORTUNITY, OSLO_APPROVAL, USER, FakeWriter

CLEAN_LETTER = "Dear Northwind Labs hiring team, I build React and TypeScript interfaces."
CLOSING = "\n\nThank you."
FABRICATED = (
    "Dear Northwind Labs hiring team, I build React interfaces. I led a team of 30 at Google and know Kubernetes. I admire Kite Commerce."
)


def ask(container: Container, kind: WritingKind = WritingKind.COVER_LETTER, opportunity: str = OPPORTUNITY):
    return container.writing.generate(USER, GenerateInput(kind=kind, opportunity_id=opportunity))


def test_status_with_ai_reports_the_model_and_every_kind(ai_container: Container) -> None:
    status = ai_container.writing.status()
    assert status.provider is WritingProvider.AI
    assert status.ai_configured is True
    assert status.model == FAKE_MODEL
    assert all(item.available for item in status.kinds)


def test_ai_draft_is_labelled_and_passes_when_grounded(ai_container: Container, writer: FakeWriter) -> None:
    writer.text = CLEAN_LETTER
    draft = ask(ai_container, WritingKind.ESSAY)
    assert draft.source is DraftSource.AI
    assert draft.model == FAKE_MODEL
    assert draft.prompt_version == ai_container.settings.writing.prompt_version
    assert draft.status is DraftStatus.READY
    request = writer.calls[0]
    assert request.opportunity.id == OPPORTUNITY
    assert {fact.id for fact in request.facts} >= {"name", "ex_lumen", "skill:React"}


def test_unsupported_claims_and_other_employers_from_ai_are_flagged_not_kept_silently(ai_container: Container, writer: FakeWriter) -> None:
    writer.text = FABRICATED
    draft = ask(ai_container)
    assert draft.status is DraftStatus.NEEDS_FIXES
    kinds = {issue.kind for issue in draft.issues}
    assert {IssueKind.UNSUPPORTED_CLAIM, IssueKind.OTHER_EMPLOYER} <= kinds
    cleaned = ai_container.writing.strip_flagged(USER, draft.id)
    assert cleaned.version == draft.version + 1
    assert cleaned.source is DraftSource.USER
    assert "Google" not in cleaned.text
    assert "Kite Commerce" not in cleaned.text
    assert cleaned.status is DraftStatus.READY


def test_ai_outage_falls_back_to_the_template_for_letters_but_not_for_essays(ai_container: Container, writer: FakeWriter) -> None:
    writer.unavailable = True
    assert ask(ai_container).source is DraftSource.TEMPLATE
    with pytest.raises(DomainError) as error:
        ask(ai_container, WritingKind.ESSAY)
    assert error.value.code is ErrorCode.SERVICE_UNAVAILABLE
    assert error.value.detail == WritingFailure.AI_UNAVAILABLE.value


def test_ai_refusal_is_reported_and_nothing_is_stored(ai_container: Container, writer: FakeWriter) -> None:
    writer.refused = True
    with pytest.raises(DomainError) as error:
        ask(ai_container)
    assert error.value.detail == WritingFailure.AI_REFUSED.value
    assert ai_container.writing.drafts(USER) == []


def test_versions_are_numbered_per_kind_and_opportunity(container: Container) -> None:
    first = ask(container)
    second = ask(container)
    cv = ask(container, WritingKind.TAILORED_CV)
    other = ask(container, opportunity="opp_intl_oslo")
    assert (first.version, second.version, cv.version, other.version) == (1, 2, 1, 1)
    edited = container.writing.edit(USER, second.id, f"{second.text}{CLOSING}")
    assert (edited.version, edited.parent_id) == (3, second.id)
    versions = container.writing.drafts(USER, OPPORTUNITY, WritingKind.COVER_LETTER)
    assert [d.version for d in versions] == [3, 2, 1]
    assert container.writing.get(USER, first.id).text == first.text


def test_version_limit(container: Container) -> None:
    limit = container.settings.writing.max_versions_per_document
    for _ in range(limit):
        ask(container)
    with pytest.raises(DomainError) as error:
        ask(container)
    assert error.value.detail == WritingFailure.VERSION_LIMIT.value


def test_other_members_cannot_see_a_draft(container: Container) -> None:
    draft = ask(container)
    with pytest.raises(DomainError) as error:
        container.writing.get("usr_someone_else", draft.id)
    assert error.value.code is ErrorCode.NOT_FOUND


def test_unknown_opportunity_is_not_found(container: Container) -> None:
    with pytest.raises(DomainError) as error:
        ask(container, opportunity="opp_missing")
    assert error.value.code is ErrorCode.NOT_FOUND


def test_attaching_puts_exactly_the_shown_text_into_the_approval(container: Container) -> None:
    draft = ask(container)
    attached = container.writing.attach(USER, draft.id, APPROVAL)
    assert attached.attached_approval_ids == [APPROVAL]
    approval = container.approvals.get(USER, APPROVAL)
    assert approval.materials.cover_letter == draft.text
    [entry] = approval.materials.writing
    assert (entry.kind, entry.draft_id, entry.version, entry.source, entry.text) == (
        WritingKind.COVER_LETTER,
        draft.id,
        1,
        DraftSource.TEMPLATE,
        draft.text,
    )


def test_attaching_a_newer_version_replaces_the_older_one(container: Container) -> None:
    first = ask(container)
    container.writing.attach(USER, first.id, APPROVAL)
    second = container.writing.edit(USER, first.id, f"{first.text}{CLOSING}")
    container.writing.attach(USER, second.id, APPROVAL)
    approval = container.approvals.get(USER, APPROVAL)
    assert [w.version for w in approval.materials.writing] == [2]
    assert approval.materials.cover_letter == second.text
    assert container.writing.get(USER, first.id).attached_approval_ids == []
    assert container.writing.get(USER, second.id).attached_approval_ids == [APPROVAL]


def test_a_cv_is_attached_beside_the_cover_letter(container: Container) -> None:
    container.writing.attach(USER, ask(container).id, APPROVAL)
    container.writing.attach(USER, ask(container, WritingKind.TAILORED_CV).id, APPROVAL)
    kinds = {w.kind for w in container.approvals.get(USER, APPROVAL).materials.writing}
    assert kinds == {WritingKind.COVER_LETTER, WritingKind.TAILORED_CV}


def test_a_draft_with_issues_cannot_be_attached(ai_container: Container, writer: FakeWriter) -> None:
    writer.text = FABRICATED
    draft = ask(ai_container)
    before = ai_container.approvals.get(USER, APPROVAL).materials.cover_letter
    with pytest.raises(DomainError) as error:
        ai_container.writing.attach(USER, draft.id, APPROVAL)
    assert error.value.detail == WritingFailure.HAS_ISSUES.value
    assert ai_container.approvals.get(USER, APPROVAL).materials.cover_letter == before


def test_attaching_to_another_opportunitys_application_is_refused(container: Container) -> None:
    draft = ask(container)
    with pytest.raises(DomainError) as error:
        container.writing.attach(USER, draft.id, OSLO_APPROVAL)
    assert error.value.detail == WritingFailure.OPPORTUNITY_MISMATCH.value


def test_a_closed_approval_cannot_receive_writing(container: Container) -> None:
    draft = ask(container)
    container.approvals.reject(USER, APPROVAL)
    with pytest.raises(DomainError) as error:
        container.writing.attach(USER, draft.id, APPROVAL)
    assert error.value.detail == WritingFailure.APPROVAL_CLOSED.value


def test_detaching_restores_the_default_cover_letter(container: Container) -> None:
    original = container.approvals.get(USER, APPROVAL).materials.cover_letter
    draft = container.writing.edit(USER, ask(container).id, "Dear Northwind Labs hiring team, I build React interfaces.")
    container.writing.attach(USER, draft.id, APPROVAL)
    released = container.writing.detach(USER, draft.id, APPROVAL)
    assert released.attached_approval_ids == []
    approval = container.approvals.get(USER, APPROVAL)
    assert approval.materials.writing == []
    assert approval.materials.cover_letter != draft.text
    assert "Northwind Labs" in approval.materials.cover_letter
    assert original


def test_removing_an_attached_draft_detaches_it_and_hides_it(container: Container) -> None:
    draft = ask(container)
    container.writing.attach(USER, draft.id, APPROVAL)
    container.writing.remove(USER, draft.id)
    assert container.writing.drafts(USER) == []
    assert container.approvals.get(USER, APPROVAL).materials.writing == []
