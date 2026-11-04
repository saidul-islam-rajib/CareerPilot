from careerpilot.administration.context import AdminActor
from careerpilot.candidate.ports import AccountRepository
from careerpilot.platform.enums import AdminArea, PermissionAction
from careerpilot.platform.errors import not_found
from careerpilot.privacy.consents import ConsentService
from careerpilot.privacy.models import AdminDeletionView, AdminExportView, ConsentOverview
from careerpilot.privacy.ports import DeletionRepository, ExportRepository

EXPORTS_VIEWED = "privacy.exports_viewed"
DELETIONS_VIEWED = "privacy.deletions_viewed"
CONSENTS_VIEWED = "privacy.consents_viewed"
ALL_REQUESTS = "all"


class AdminPrivacy:
    def __init__(
        self,
        exports: ExportRepository,
        deletions: DeletionRepository,
        consents: ConsentService,
        accounts: AccountRepository,
        page_size: int,
    ) -> None:
        self._exports = exports
        self._deletions = deletions
        self._consents = consents
        self._accounts = accounts
        self._page_size = page_size

    def exports(self, actor: AdminActor) -> list[AdminExportView]:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        actor.record(EXPORTS_VIEWED, ALL_REQUESTS)
        return [
            AdminExportView(
                id=r.id,
                user_id=r.user_id,
                kind=r.kind,
                format=r.format,
                status=r.status,
                requested_at=r.requested_at,
                completed_at=r.completed_at,
                expires_at=r.expires_at,
                size_bytes=r.size_bytes,
                failure=r.failure,
            )
            for r in self._exports.recent(self._page_size)
        ]

    def deletions(self, actor: AdminActor) -> list[AdminDeletionView]:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        actor.record(DELETIONS_VIEWED, ALL_REQUESTS)
        return [
            AdminDeletionView(
                id=r.id,
                user_id=r.user_id,
                status=r.status,
                requested_at=r.requested_at,
                scheduled_for=r.scheduled_for,
                cancelled_at=r.cancelled_at,
                completed_at=r.completed_at,
            )
            for r in self._deletions.recent(self._page_size)
        ]

    def consents(self, actor: AdminActor, user_id: str) -> ConsentOverview:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        account = self._accounts.get(user_id)
        if account is None:
            raise not_found("user")
        actor.record(CONSENTS_VIEWED, account.user.full_name)
        return self._consents.overview(user_id)
