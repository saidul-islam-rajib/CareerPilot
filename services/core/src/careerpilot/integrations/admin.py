from careerpilot.administration.context import AdminActor
from careerpilot.candidate.ports import AccountRepository
from careerpilot.integrations.connections import ConnectionService
from careerpilot.integrations.models import ConnectionView
from careerpilot.platform.enums import AdminArea, PermissionAction
from careerpilot.platform.errors import not_found

AUDIT_ACTION = "integration.viewed"


class AdminIntegrations:
    def __init__(self, connections: ConnectionService, accounts: AccountRepository) -> None:
        self._connections = connections
        self._accounts = accounts

    def connected_accounts(self, actor: AdminActor, user_id: str) -> list[ConnectionView]:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        account = self._accounts.get(user_id)
        if account is None:
            raise not_found("user")
        actor.record(AUDIT_ACTION, account.user.full_name)
        return self._connections.views(user_id)
