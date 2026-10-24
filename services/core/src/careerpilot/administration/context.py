from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TypeVar

from careerpilot.administration.models import AdminSummary, AuditEntry, Page
from careerpilot.administration.permissions import can
from careerpilot.administration.ports import AdminAccountRepository, AuditLog, Directory, PlatformSettingsRepository
from careerpilot.candidate.ports import AccountRepository, WorkspaceRepository
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.config import Settings
from careerpilot.platform.enums import ActorType, AdminArea, PermissionAction
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.security import PasswordHasher, TokenService

ADMIN_AUDIENCE = "admin"
FIRST_PAGE = 1

Item = TypeVar("Item")


@dataclass(frozen=True)
class AdminContext:
    settings: Settings
    clock: Clock
    ids: IdGenerator
    admins: AdminAccountRepository
    platform: PlatformSettingsRepository
    audit: AuditLog
    directory: Directory
    accounts: AccountRepository
    workspaces: WorkspaceRepository
    hasher: PasswordHasher
    tokens: TokenService


@dataclass(frozen=True)
class AdminActor:
    summary: AdminSummary
    context: AdminContext = field(repr=False)

    def require(self, area: AdminArea, action: PermissionAction) -> None:
        if not can(self.summary.role, area, action):
            raise DomainError(ErrorCode.FORBIDDEN)

    def record(self, action: str, target: str) -> None:
        self.context.audit.append(
            AuditEntry(
                id=self.context.ids.next("aud"),
                at=iso(self.context.clock.now()),
                actor_name=self.summary.full_name,
                actor_type=ActorType.ADMIN,
                action=action,
                target=target,
            )
        )


@dataclass(frozen=True)
class PageRequest:
    page: int = FIRST_PAGE
    page_size: int = 0
    search: str | None = None
    status: str | None = None


def paginate(
    items: list[Item], request: PageRequest, default_size: int, text: Callable[[Item], str], status: Callable[[Item], str]
) -> Page[Item]:
    search = (request.search or "").strip().lower()
    filtered = [i for i in items if (not search or search in text(i).lower()) and (not request.status or status(i) == request.status)]
    size = request.page_size or default_size
    page = max(FIRST_PAGE, request.page)
    start = (page - FIRST_PAGE) * size
    return Page[Item](items=filtered[start : start + size], total=len(filtered), page=page, page_size=size)
