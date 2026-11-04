import hashlib
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import StoredFile, UserSummary
from careerpilot.candidate.ports import Account, CandidateWorkspace
from careerpilot.messaging.ports import MessageRepository, PushDeviceRepository
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.email_delivery import Courier, OutgoingEmail
from careerpilot.platform.enums import UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode, conflict
from careerpilot.platform.files import FileStorage
from careerpilot.platform.messages import translate
from careerpilot.platform.one_time_codes import random_token
from careerpilot.privacy.enums import DeletionStatus
from careerpilot.privacy.models import DeletionPlan, DeletionRecord, DeletionView, RetainedItem
from careerpilot.privacy.ports import DeletionRepository

ERASED = b""
PASSWORD_BYTES = 32
LINE = "\n"
REASON = "account anonymized"
DELETABLE_STATUSES = frozenset({UserAccountStatus.ACTIVE, UserAccountStatus.PAUSED})


@dataclass(frozen=True)
class DeletionContext:
    candidate: CandidateContext
    deletions: DeletionRepository
    courier: Courier
    storage: FileStorage
    devices: PushDeviceRepository
    messages: MessageRepository
    disconnect: Callable[[str], None]
    erase_exports: Callable[[str], int]
    scrub_sessions: Callable[[str], None]
    empty_workspace: Callable[[str], CandidateWorkspace]
    grace_days: Callable[[], int]


def stored_keys(workspace: CandidateWorkspace) -> list[str]:
    files: list[StoredFile] = [version for document in workspace.profile.documents for version in document.versions]
    if workspace.profile.photo is not None:
        files.append(workspace.profile.photo)
    return [stored.key for stored in files]


class DeletionService:
    def __init__(self, context: DeletionContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.privacy.deletion

    def plan(self) -> DeletionPlan:
        retained = [
            RetainedItem(record=rule.record, retention_days=rule.retention_days, reason=translate(rule.reason_key))
            for rule in self._config.retained
        ]
        return DeletionPlan(
            grace_days=self._ctx.grace_days(), erased=list(self._config.erased), retained=retained, external=list(self._config.external)
        )

    def view(self, user_id: str) -> DeletionView:
        record = self._ctx.deletions.latest(user_id)
        if record is None or record.status is not DeletionStatus.REQUESTED:
            return DeletionView(plan=self.plan())
        return DeletionView(status=record.status, requested_at=record.requested_at, scheduled_for=record.scheduled_for, plan=self.plan())

    def request(self, user_id: str, password: str) -> DeletionView:
        account = self._candidate.accounts.get(user_id)
        if account is None or not self._candidate.hasher.verify(account.password_hash, password):
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        if account.status is UserAccountStatus.PENDING_DELETION:
            return self.view(user_id)
        if account.status not in DELETABLE_STATUSES:
            raise conflict("account_status")
        now = self._candidate.clock.now()
        account.status = UserAccountStatus.PENDING_DELETION
        self._candidate.accounts.save(account)
        self._ctx.disconnect(user_id)
        self._ctx.deletions.save(
            DeletionRecord(
                id=self._candidate.ids.next("del"),
                user_id=user_id,
                status=DeletionStatus.REQUESTED,
                requested_at=iso(now),
                scheduled_for=iso(now + timedelta(days=self._ctx.grace_days())),
            )
        )
        return self.view(user_id)

    def cancel(self, user_id: str) -> DeletionView:
        record = self._ctx.deletions.latest(user_id)
        account = self._candidate.accounts.get(user_id)
        if record is None or record.status is not DeletionStatus.REQUESTED or account is None:
            raise conflict("no_deletion")
        account.status = UserAccountStatus.ACTIVE
        self._candidate.accounts.save(account)
        record.status = DeletionStatus.CANCELLED
        record.cancelled_at = iso(self._candidate.clock.now())
        self._ctx.deletions.save(record)
        return self.view(user_id)

    def process_due(self) -> int:
        now = self._candidate.clock.now()
        due = [r for r in self._ctx.deletions.with_status(DeletionStatus.REQUESTED) if parse_iso(r.scheduled_for) <= now]
        for record in due:
            self.anonymize(record)
        return len(due)

    def anonymize(self, record: DeletionRecord) -> None:
        user_id = record.user_id
        account = self._candidate.accounts.get(user_id)
        if account is None or account.status is UserAccountStatus.DELETED:
            return
        self._confirm_by_email(account)
        workspace = self._candidate.workspaces.get(user_id)
        self._erase_files(stored_keys(workspace))
        self._erase_files(self._ctx.messages.erase_sender(user_id, translate("privacy.deletedUser")))
        self._ctx.devices.remove([device.token for device in self._ctx.devices.for_user(user_id)], REASON)
        self._ctx.erase_exports(user_id)
        self._ctx.disconnect(user_id)
        self._ctx.scrub_sessions(user_id)
        self._candidate.workspaces.save(user_id, self._ctx.empty_workspace(user_id))
        self._candidate.accounts.save(self._anonymous(account))
        record.status = DeletionStatus.COMPLETED
        record.completed_at = iso(self._candidate.clock.now())
        self._ctx.deletions.save(record)

    def _erase_files(self, keys: list[str]) -> None:
        for key in keys:
            self._ctx.storage.put(key, ERASED)

    def _anonymous(self, account: Account) -> Account:
        digest = hashlib.sha256(account.user.id.encode()).hexdigest()[: self._config.anonymized_id_length]
        user = UserSummary(
            id=account.user.id,
            full_name=translate("privacy.deletedUser"),
            email=f"deleted-{digest}@{self._config.anonymized_email_domain}",
        )
        return replace(
            account,
            user=user,
            password_hash=self._candidate.hasher.hash(random_token(PASSWORD_BYTES)),
            status=UserAccountStatus.DELETED,
            consent_ip=None,
            consent_device=None,
            credentials_changed_at=iso(self._candidate.clock.now()),
        )

    def _confirm_by_email(self, account: Account) -> None:
        if not self._config.final_email_enabled:
            return
        settings = self._candidate.settings
        product = settings.branding.product_name
        body = LINE.join(
            (
                translate("privacy.email.greeting", {"name": account.user.full_name}),
                "",
                translate("privacy.email.body", {"product": product}),
                "",
                translate("email.credit", {"url": str(settings.branding.developer_url)}),
            )
        )
        self._ctx.courier.deliver(
            OutgoingEmail(
                sender_name=product,
                sender_address=settings.mail.sender_address,
                reply_to=settings.mail.sender_address,
                to=account.user.email,
                subject=translate("privacy.email.subject", {"product": product}),
                body=body,
            ),
            lambda _error: None,
        )
