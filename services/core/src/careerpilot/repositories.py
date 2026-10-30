from collections.abc import Callable
from dataclasses import dataclass, field

from careerpilot.administration.adapters.in_memory import (
    InMemoryAdminAccountRepository,
    InMemoryAuditLog,
    InMemoryDirectory,
    InMemoryPlatformSettingsRepository,
)
from careerpilot.administration.adapters.sql import (
    SqlAdminAccountRepository,
    SqlAuditLog,
    SqlDirectory,
    SqlPlatformSettingsRepository,
)
from careerpilot.administration.models import PlatformSettings
from careerpilot.administration.ports import AdminAccountRepository, AuditLog, Directory, PlatformSettingsRepository
from careerpilot.candidate.adapters.in_memory import InMemoryAccountRepository, InMemoryOpportunityRepository, InMemoryWorkspaceRepository
from careerpilot.candidate.adapters.sql import SqlAccountRepository, SqlOpportunityRepository, SqlWorkspaceRepository
from careerpilot.candidate.ports import AccountRepository, CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.discovery.adapters.in_memory import InMemoryListingCatalog
from careerpilot.discovery.adapters.sql import SqlListingCatalog
from careerpilot.discovery.ports import ListingCatalog
from careerpilot.messaging.adapters.in_memory import (
    InMemoryConversationRepository,
    InMemoryMessageRepository,
    InMemoryNotificationRepository,
    InMemoryPushDeviceRepository,
)
from careerpilot.messaging.adapters.sql import (
    SqlConversationRepository,
    SqlMessageRepository,
    SqlNotificationRepository,
    SqlPushDeviceRepository,
)
from careerpilot.messaging.ports import ConversationRepository, MessageRepository, NotificationRepository, PushDeviceRepository
from careerpilot.platform.clock import SystemClock
from careerpilot.platform.persistence import Database
from careerpilot.platform.security import PasswordHasher

WorkspaceFactory = Callable[[str], CandidateWorkspace]


@dataclass(frozen=True)
class Repositories:
    accounts: AccountRepository
    opportunities: OpportunityRepository
    workspaces: WorkspaceRepository
    admins: AdminAccountRepository
    platform: PlatformSettingsRepository
    audit: AuditLog
    directory: Directory
    listings: ListingCatalog
    notifications: NotificationRepository = field(default_factory=InMemoryNotificationRepository)
    conversations: ConversationRepository = field(default_factory=InMemoryConversationRepository)
    messages: MessageRepository = field(default_factory=InMemoryMessageRepository)
    push_devices: PushDeviceRepository = field(default_factory=InMemoryPushDeviceRepository)


RepositoryFactory = Callable[[PasswordHasher, WorkspaceFactory, PlatformSettings], Repositories]


def in_memory_repositories(empty: WorkspaceFactory, platform_defaults: PlatformSettings) -> Repositories:
    return Repositories(
        accounts=InMemoryAccountRepository(),
        opportunities=InMemoryOpportunityRepository([]),
        workspaces=InMemoryWorkspaceRepository(empty),
        admins=InMemoryAdminAccountRepository([]),
        platform=InMemoryPlatformSettingsRepository(platform_defaults),
        audit=InMemoryAuditLog([]),
        directory=InMemoryDirectory(),
        listings=InMemoryListingCatalog(),
    )


def sql_repositories(database: Database, empty: WorkspaceFactory, platform_defaults: PlatformSettings) -> Repositories:
    return Repositories(
        accounts=SqlAccountRepository(database),
        opportunities=SqlOpportunityRepository(database),
        workspaces=SqlWorkspaceRepository(database, empty),
        admins=SqlAdminAccountRepository(database),
        platform=SqlPlatformSettingsRepository(database, platform_defaults),
        audit=SqlAuditLog(database),
        directory=SqlDirectory(database),
        listings=SqlListingCatalog(database),
        notifications=SqlNotificationRepository(database),
        conversations=SqlConversationRepository(database),
        messages=SqlMessageRepository(database),
        push_devices=SqlPushDeviceRepository(database, SystemClock()),
    )
