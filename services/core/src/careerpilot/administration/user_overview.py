from dataclasses import dataclass

from careerpilot.administration.context import AdminActor
from careerpilot.automation.models import AutomationRule
from careerpilot.candidate.ports import AccountRepository, WorkspaceRepository
from careerpilot.government.models import GovApplication
from careerpilot.government.ports import CircularRepository, GovApplicationRepository
from careerpilot.messaging.ports import NotificationRepository
from careerpilot.platform.enums import (
    AdminArea,
    FeeStatus,
    GovApplicationStatus,
    NotificationKind,
    PermissionAction,
    SecretKind,
)
from careerpilot.platform.errors import not_found
from careerpilot.platform.model import CamelModel
from careerpilot.privacy.enums import DeletionStatus, ExportFormat, ExportKind, ExportStatus
from careerpilot.privacy.models import DeletionRecord, ExportRequest
from careerpilot.privacy.ports import DeletionRepository, ExportRepository
from careerpilot.writing.enums import DraftStatus, WritingKind, WritingTone
from careerpilot.writing.models import WritingDraft
from careerpilot.writing.ports import WritingRepository

NOTIFICATIONS_SHOWN = 100


class AdminGovApplication(CamelModel):
    id: str
    circular_title: str
    status: GovApplicationStatus
    submitted_at: str | None = None
    fee_status: FeeStatus
    stages: int
    secrets_present: list[SecretKind]
    created_at: str


class AdminWritingDraft(CamelModel):
    id: str
    kind: WritingKind
    title: str
    organization: str
    version: int
    status: DraftStatus
    tone: WritingTone
    word_count: int
    created_at: str


class AdminExport(CamelModel):
    id: str
    kind: ExportKind
    format: ExportFormat
    status: ExportStatus
    requested_at: str
    completed_at: str | None = None


class AdminDeletion(CamelModel):
    id: str
    status: DeletionStatus
    requested_at: str
    scheduled_for: str
    cancelled_at: str | None = None
    completed_at: str | None = None


class AdminNotification(CamelModel):
    id: str
    kind: NotificationKind
    title: str
    created_at: str
    read: bool


class AdminUserOverview(CamelModel):
    government_applications: list[AdminGovApplication]
    writing_drafts: list[AdminWritingDraft]
    exports: list[AdminExport]
    deletion: AdminDeletion | None = None
    notifications: list[AdminNotification]
    unread_notifications: int
    automation_rules: list[AutomationRule]


@dataclass(frozen=True)
class UserOverviewParts:
    accounts: AccountRepository
    workspaces: WorkspaceRepository
    gov_applications: GovApplicationRepository
    circulars: CircularRepository
    drafts: WritingRepository
    exports: ExportRepository
    deletions: DeletionRepository
    notifications: NotificationRepository


class AdminUserOverviewService:
    def __init__(self, parts: UserOverviewParts) -> None:
        self._parts = parts

    def get(self, actor: AdminActor, user_id: str) -> AdminUserOverview:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        account = self._parts.accounts.get(user_id)
        if account is None:
            raise not_found("user")
        actor.record("user.overview_viewed", account.user.full_name)
        parts = self._parts
        deletion = parts.deletions.latest(user_id)
        return AdminUserOverview(
            government_applications=[self._government(a) for a in parts.gov_applications.for_user(user_id)],
            writing_drafts=[self._draft(d) for d in parts.drafts.for_user(user_id)],
            exports=[self._export(e) for e in parts.exports.for_user(user_id)],
            deletion=self._deletion(deletion) if deletion else None,
            notifications=[
                AdminNotification(id=n.id, kind=n.kind, title=n.title, created_at=n.created_at, read=n.read_at is not None)
                for n in parts.notifications.recent(user_id, NOTIFICATIONS_SHOWN)
            ],
            unread_notifications=parts.notifications.unread_count(user_id),
            automation_rules=parts.workspaces.get(user_id).preferences.automation.active_rules(),
        )

    @staticmethod
    def _draft(draft: WritingDraft) -> AdminWritingDraft:
        return AdminWritingDraft(
            id=draft.id,
            kind=draft.kind,
            title=draft.title,
            organization=draft.organization,
            version=draft.version,
            status=draft.status,
            tone=draft.tone,
            word_count=draft.word_count,
            created_at=draft.created_at,
        )

    @staticmethod
    def _export(request: ExportRequest) -> AdminExport:
        return AdminExport(
            id=request.id,
            kind=request.kind,
            format=request.format,
            status=request.status,
            requested_at=request.requested_at,
            completed_at=request.completed_at,
        )

    @staticmethod
    def _deletion(record: DeletionRecord) -> AdminDeletion:
        return AdminDeletion(
            id=record.id,
            status=record.status,
            requested_at=record.requested_at,
            scheduled_for=record.scheduled_for,
            cancelled_at=record.cancelled_at,
            completed_at=record.completed_at,
        )

    def _government(self, application: GovApplication) -> AdminGovApplication:
        circular = self._parts.circulars.get(application.circular_id)
        return AdminGovApplication(
            id=application.id,
            circular_title=circular.title if circular else application.circular_id,
            status=application.status,
            submitted_at=application.submitted_at,
            fee_status=application.fee.status,
            stages=len(application.stages),
            secrets_present=sorted(application.sealed),
            created_at=application.created_at,
        )
