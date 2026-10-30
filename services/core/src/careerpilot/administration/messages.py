from careerpilot.administration.context import AdminActor
from careerpilot.candidate.ports import AccountRepository, WorkspaceRepository
from careerpilot.messaging.models import Connection, MessagePage, MessageView
from careerpilot.messaging.service import TEAM_MEMBER, Draft, LinkFactory, MessagingService, Sender
from careerpilot.platform.enums import AdminArea, ContactKind, MemberType, PermissionAction
from careerpilot.platform.errors import not_found
from careerpilot.platform.model import CamelModel


class AdminFileLink(CamelModel):
    id: str
    name: str
    kind: str
    file_name: str
    content_type: str
    size_bytes: int
    version: int
    updated_at: str
    url: str


class AdminContactView(CamelModel):
    kind: ContactKind
    label: str
    value: str
    verified: bool
    primary: bool


class AdminUserFiles(CamelModel):
    contacts: list[AdminContactView]
    documents: list[AdminFileLink]
    photo_url: str | None = None


class AdminMessages:
    def __init__(self, messaging: MessagingService, accounts: AccountRepository, workspaces: WorkspaceRepository) -> None:
        self._messaging = messaging
        self._accounts = accounts
        self._workspaces = workspaces

    def team_page(self, actor: AdminActor, user_id: str, before: str | None, link: LinkFactory) -> MessagePage:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        self._require_user(user_id)
        page = self._messaging.team_page(user_id, before, link)
        self._messaging.read(TEAM_MEMBER, page.conversation.id)
        return page

    def send(self, actor: AdminActor, user_id: str, draft: Draft, link: LinkFactory) -> MessageView:
        actor.require(AdminArea.USERS, PermissionAction.UPDATE)
        name = self._require_user(user_id)
        conversation = self._messaging.team(user_id)
        sender = Sender(id=actor.summary.id, type=MemberType.TEAM, name=actor.summary.full_name)
        message = self._messaging.post(sender, conversation.id, draft, link)
        actor.record("chat.team_message", name)
        return message

    def connections(self, actor: AdminActor, user_id: str, link: LinkFactory) -> list[Connection]:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        self._require_user(user_id)
        return self._messaging.connections(user_id, link)

    def conversation(self, actor: AdminActor, conversation_id: str, before: str | None, link: LinkFactory) -> MessagePage:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        page = self._messaging.admin_page(conversation_id, before, link)
        actor.record("chat.viewed", page.conversation.title or conversation_id)
        return page

    def files(self, actor: AdminActor, user_id: str, link: LinkFactory) -> AdminUserFiles:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        name = self._require_user(user_id)
        profile = self._workspaces.get(user_id).profile
        actor.record("user.files_viewed", name)
        documents = [
            AdminFileLink(
                id=document.id,
                name=document.name,
                kind=document.kind.value,
                file_name=document.current.file_name,
                content_type=document.current.content_type,
                size_bytes=document.current.size_bytes,
                version=document.current.version,
                updated_at=document.updated_at,
                url=link(document.current.key, document.current.file_name),
            )
            for document in profile.active_documents()
        ]
        contacts = [
            AdminContactView(kind=c.kind, label=c.label, value=c.value, verified=c.verified, primary=c.is_primary)
            for c in profile.active_contacts()
        ]
        photo = profile.photo
        return AdminUserFiles(
            contacts=contacts, documents=documents, photo_url=link(photo.key, photo.file_name) if photo else profile.photo_url
        )

    def _require_user(self, user_id: str) -> str:
        account = self._accounts.get(user_id)
        if account is None:
            raise not_found("user")
        return account.user.full_name
