import hashlib
import json
from collections.abc import Callable

from careerpilot.candidate.answer_rules import has_blank_answers
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import (
    ApprovalDetail,
    BulkApprovalRequest,
    BulkApprovalResult,
    BulkApprovalRow,
    BulkRefusal,
)
from careerpilot.candidate.services.approvals import ApprovalService
from careerpilot.platform.enums import ApprovalState, BulkBlock
from careerpilot.platform.errors import validation_error

FeeOpportunities = Callable[[str], set[str]]
TOKEN_LENGTH = 32


def review_token(approval: ApprovalDetail) -> str:
    shown = {"opportunity": approval.opportunity.id, "route": approval.route, "materials": approval.materials.model_dump(mode="json")}
    encoded = json.dumps(shown, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()[:TOKEN_LENGTH]


class BulkApprovalService:
    def __init__(self, context: CandidateContext, approvals: ApprovalService, fee_opportunities: FeeOpportunities) -> None:
        self._ctx = context
        self._approvals = approvals
        self._fees = fee_opportunities

    def rows(self, user_id: str) -> list[BulkApprovalRow]:
        pending = [a for a in self._ctx.workspaces.get(user_id).approvals if a.state is ApprovalState.PENDING]
        fees = self._fees(user_id)
        return [self._row(a, self._blocks(a, fees)) for a in sorted(pending, key=lambda a: a.expires_at)]

    def approve(self, user_id: str, request: BulkApprovalRequest) -> BulkApprovalResult:
        if not request.items or len(request.items) > self._ctx.settings.submission.bulk_max_items:
            raise validation_error("bulk_items")
        known = {a.id: a for a in self._ctx.workspaces.get(user_id).approvals}
        fees = self._fees(user_id)
        approved: list[str] = []
        refused: list[BulkRefusal] = []
        for item in request.items:
            reasons = self._refusal(known.get(item.approval_id), item.review_token, fees)
            if reasons:
                refused.append(BulkRefusal(approval_id=item.approval_id, reasons=reasons))
                continue
            self._approvals.approve(user_id, item.approval_id)
            approved.append(item.approval_id)
        return BulkApprovalResult(approved=approved, refused=refused)

    def _refusal(self, approval: ApprovalDetail | None, token: str, fees: set[str]) -> list[BulkBlock]:
        if approval is None:
            return [BulkBlock.UNKNOWN_APPROVAL]
        if approval.state is not ApprovalState.PENDING:
            return [BulkBlock.NOT_PENDING]
        if review_token(approval) != token:
            return [BulkBlock.CHANGED]
        return self._blocks(approval, fees)

    def _blocks(self, approval: ApprovalDetail, fees: set[str]) -> list[BulkBlock]:
        phrases = self._ctx.settings.submission.attestation_phrases
        questions = " ".join(answer.question.lower() for answer in approval.materials.answers)
        checks = [
            (approval.opportunity.has_hard_failure, BulkBlock.HARD_FAILURE),
            (has_blank_answers(approval.materials.answers), BulkBlock.UNANSWERED_QUESTIONS),
            (approval.opportunity.id in fees, BulkBlock.FEE),
            (any(phrase.lower() in questions for phrase in phrases), BulkBlock.ATTESTATION),
        ]
        return [block for found, block in checks if found]

    @staticmethod
    def _row(approval: ApprovalDetail, blocks: list[BulkBlock]) -> BulkApprovalRow:
        return BulkApprovalRow(
            approval_id=approval.id,
            employer=approval.opportunity.organization,
            role=approval.opportunity.title,
            route=approval.route,
            cv_name=approval.materials.cv.name,
            writing_kinds=[draft.kind for draft in approval.materials.writing],
            warnings=blocks,
            eligible=not blocks,
            review_token=review_token(approval),
            expires_at=approval.expires_at,
        )
