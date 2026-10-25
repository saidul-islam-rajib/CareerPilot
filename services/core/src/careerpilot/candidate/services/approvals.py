from datetime import timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import (
    ApplicationRecord,
    ApprovalDetail,
    ApprovalMaterials,
    ApprovalSummary,
    CvRef,
    SentFile,
    TimelineEntry,
)
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import (
    AnswerSource,
    ApprovalState,
    DocumentKind,
    OpportunityDecision,
    OutcomeStatus,
    SubmissionStatus,
    SubmissionWindowKind,
    TimelineActor,
)
from careerpilot.platform.errors import conflict, not_found
from careerpilot.platform.messages import translate
from careerpilot.platform.validation import require_text

FIRST_CV_VERSION = 1
CV_FILE_EXTENSION = ".pdf"


def window_label(workspace: CandidateWorkspace) -> str | None:
    window = workspace.preferences.submission_window
    if window.kind is SubmissionWindowKind.DAILY_WINDOW:
        return translate("settings.windowRange", {"start": window.start or "", "end": window.end or ""})
    return None


class ApprovalService:
    def __init__(self, context: CandidateContext, opportunities: OpportunityService) -> None:
        self._ctx = context
        self._opportunities = opportunities

    def list_pending(self, user_id: str) -> list[ApprovalSummary]:
        pending = [a for a in self._ctx.workspaces.get(user_id).approvals if a.state is ApprovalState.PENDING]
        return [a.summary() for a in sorted(pending, key=lambda a: a.expires_at)]

    def get(self, user_id: str, approval_id: str) -> ApprovalDetail:
        workspace = self._ctx.workspaces.get(user_id)
        return self._find(workspace, approval_id).model_copy(update={"submission_window_label": window_label(workspace)})

    def prepare(self, user_id: str, opportunity_id: str) -> ApprovalSummary:
        workspace = self._ctx.workspaces.get(user_id)
        existing = next((a for a in workspace.approvals if a.opportunity.id == opportunity_id and a.state is ApprovalState.PENDING), None)
        if existing is not None:
            return existing.summary()
        detail = self._opportunities.detail(user_id, opportunity_id)
        workspace.decisions[opportunity_id] = OpportunityDecision.INTERESTED
        documents = workspace.profile.active_documents()
        document = next((d for d in documents if d.kind is DocumentKind.CV), documents[0] if documents else None)
        now = self._ctx.clock.now()
        approval = ApprovalDetail(
            id=self._ctx.ids.next("apr"),
            opportunity=self._opportunities.summary(workspace, opportunity_id),
            state=ApprovalState.PENDING,
            created_at=iso(now),
            expires_at=iso(now + timedelta(days=self._ctx.settings.account.approval_validity_days)),
            route=detail.route,
            materials=ApprovalMaterials(
                cv=CvRef(
                    name=document.name if document else workspace.profile.full_name,
                    version=document.current.version if document else FIRST_CV_VERSION,
                ),
                cover_letter="",
                answers=[],
            ),
        )
        workspace.approvals.insert(0, approval)
        self._ctx.workspaces.save(user_id, workspace)
        return approval.summary()

    def update_answer(self, user_id: str, approval_id: str, answer_id: str, answer: str) -> ApprovalDetail:
        workspace = self._ctx.workspaces.get(user_id)
        approval = self._pending(workspace, approval_id)
        item = next((a for a in approval.materials.answers if a.id == answer_id), None)
        if item is None:
            raise not_found("answer")
        item.answer = require_text(answer, self._ctx.settings.validation.answer)
        item.source = AnswerSource.USER
        self._ctx.workspaces.save(user_id, workspace)
        return approval.model_copy(update={"submission_window_label": window_label(workspace)})

    def approve(self, user_id: str, approval_id: str) -> ApprovalDetail:
        workspace = self._ctx.workspaces.get(user_id)
        approval = self._pending(workspace, approval_id)
        approval.state = ApprovalState.APPROVED
        workspace.applications.insert(0, self._queued_application(workspace, approval))
        self._ctx.workspaces.save(user_id, workspace)
        return approval.model_copy(update={"submission_window_label": window_label(workspace)})

    def reject(self, user_id: str, approval_id: str) -> ApprovalDetail:
        workspace = self._ctx.workspaces.get(user_id)
        approval = self._pending(workspace, approval_id)
        approval.state = ApprovalState.REJECTED
        self._ctx.workspaces.save(user_id, workspace)
        return approval

    def _find(self, workspace: CandidateWorkspace, approval_id: str) -> ApprovalDetail:
        approval = next((a for a in workspace.approvals if a.id == approval_id), None)
        if approval is None:
            raise not_found("approval")
        return approval

    def _pending(self, workspace: CandidateWorkspace, approval_id: str) -> ApprovalDetail:
        approval = self._find(workspace, approval_id)
        if approval.state is not ApprovalState.PENDING:
            raise conflict("approval_not_pending")
        return approval

    def _queued_application(self, workspace: CandidateWorkspace, approval: ApprovalDetail) -> ApplicationRecord:
        opportunity = self._ctx.opportunities.get(approval.opportunity.id)
        if opportunity is None:
            raise not_found("opportunity")
        now = iso(self._ctx.clock.now())
        return ApplicationRecord(
            id=self._ctx.ids.next("app"),
            opportunity=approval.opportunity,
            submission_status=SubmissionStatus.APPROVED_QUEUED,
            outcome_status=OutcomeStatus.NO_RESPONSE_YET,
            updated_at=now,
            route=approval.route,
            timeline=[
                TimelineEntry(
                    at=approval.created_at,
                    actor=TimelineActor.SYSTEM,
                    text=translate("timeline.packagePrepared"),
                    status=SubmissionStatus.AWAITING_APPROVAL,
                ),
                TimelineEntry(
                    at=now, actor=TimelineActor.USER, text=translate("timeline.youApproved"), status=SubmissionStatus.APPROVED_QUEUED
                ),
            ],
            questions=[a.model_copy() for a in approval.materials.answers],
            emails=[],
            files=[SentFile(name=f"{approval.materials.cv.name}{CV_FILE_EXTENSION}", version=approval.materials.cv.version, size_bytes=0)],
            evidence=[],
            circular=opportunity.circular,
        )
