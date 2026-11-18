import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.models import BulkApprovalItem, BulkApprovalRequest
from careerpilot.fees.enums import FeeKind
from careerpilot.fees.models import FeeRuleInput
from careerpilot.platform.enums import ApprovalState, BulkBlock
from careerpilot.platform.errors import DomainError
from tests.unit.conftest import DEMO_USER

READY = "apr_frontend"
UNANSWERED = "apr_oslo"
READY_OPPORTUNITY = "opp_remote_frontend"


def request_for(container: Container, *ids: str) -> BulkApprovalRequest:
    tokens = {row.approval_id: row.review_token for row in container.bulk_approvals.rows(DEMO_USER)}
    return BulkApprovalRequest(items=[BulkApprovalItem(approval_id=i, review_token=tokens[i]) for i in ids])


def test_the_list_shows_each_package_and_flags_blocked_ones(container: Container) -> None:
    rows = {row.approval_id: row for row in container.bulk_approvals.rows(DEMO_USER)}
    assert rows[READY].eligible
    assert rows[READY].employer and rows[READY].role and rows[READY].cv_name
    assert rows[UNANSWERED].warnings == [BulkBlock.UNANSWERED_QUESTIONS]
    assert not rows[UNANSWERED].eligible


def test_only_clean_packages_are_approved_and_the_rest_are_refused_with_reasons(container: Container) -> None:
    result = container.bulk_approvals.approve(DEMO_USER, request_for(container, READY, UNANSWERED))
    assert result.approved == [READY]
    assert [(r.approval_id, r.reasons) for r in result.refused] == [(UNANSWERED, [BulkBlock.UNANSWERED_QUESTIONS])]
    assert container.approvals.get(DEMO_USER, READY).state is ApprovalState.APPROVED
    assert container.approvals.get(DEMO_USER, UNANSWERED).state is ApprovalState.PENDING


def test_a_package_changed_after_it_was_shown_is_not_approved(container: Container) -> None:
    request = request_for(container, READY)
    answer = container.approvals.get(DEMO_USER, READY).materials.answers[0]
    container.approvals.update_answer(DEMO_USER, READY, answer.id, answer.answer + " (edited)")
    result = container.bulk_approvals.approve(DEMO_USER, request)
    assert result.approved == []
    assert result.refused[0].reasons == [BulkBlock.CHANGED]


def test_a_package_with_a_fee_must_be_approved_individually(container: Container) -> None:
    container.fees.rules.create(
        DEMO_USER, FeeRuleInput(kind=FeeKind.JOB, title="Application fee", amount=500, currency="BDT", opportunity_id=READY_OPPORTUNITY)
    )
    row = next(r for r in container.bulk_approvals.rows(DEMO_USER) if r.approval_id == READY)
    assert BulkBlock.FEE in row.warnings
    result = container.bulk_approvals.approve(DEMO_USER, request_for(container, READY))
    assert result.approved == []


def test_unknown_and_repeated_items_and_empty_requests_are_refused(container: Container) -> None:
    once = request_for(container, READY)
    container.bulk_approvals.approve(DEMO_USER, once)
    again = container.bulk_approvals.approve(DEMO_USER, once)
    assert again.refused[0].reasons == [BulkBlock.NOT_PENDING]
    unknown = BulkApprovalRequest(items=[BulkApprovalItem(approval_id="apr_none", review_token="x")])
    assert container.bulk_approvals.approve(DEMO_USER, unknown).refused[0].reasons == [BulkBlock.UNKNOWN_APPROVAL]
    with pytest.raises(DomainError):
        container.bulk_approvals.approve(DEMO_USER, BulkApprovalRequest(items=[]))
