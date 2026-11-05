from collections.abc import Callable
from dataclasses import dataclass, field

from careerpilot.academic.adapters.in_memory import InMemoryAcademicRecords
from careerpilot.academic.adapters.sql import SqlAcademicRecords
from careerpilot.academic.ports import AcademicRecordRepository
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
from careerpilot.fees.adapters.in_memory import InMemoryFeeRecords
from careerpilot.fees.adapters.sql import SqlFeeRecords
from careerpilot.fees.ports import FeeRecordRepository
from careerpilot.government.adapters.in_memory import (
    InMemoryCircularRepository,
    InMemoryGovApplicationRepository,
    InMemoryHolidayRepository,
)
from careerpilot.government.adapters.sql import SqlCircularRepository, SqlGovApplicationRepository, SqlHolidayRepository
from careerpilot.government.ports import CircularRepository, GovApplicationRepository, HolidayRepository
from careerpilot.integrations.adapters.in_memory import (
    InMemoryCalendarEventRepository,
    InMemoryConnectionRepository,
    InMemorySyncedMessageRepository,
)
from careerpilot.integrations.adapters.sql import SqlCalendarEventRepository, SqlConnectionRepository, SqlSyncedMessageRepository
from careerpilot.integrations.ports import CalendarEventRepository, ConnectionRepository, SyncedMessageRepository
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
from careerpilot.platform.clock import SystemClock, UuidIdGenerator
from careerpilot.platform.persistence import Database
from careerpilot.platform.security import PasswordHasher
from careerpilot.portal.adapters.in_memory import InMemoryPortalRecords
from careerpilot.portal.adapters.sql import SqlPortalRecords
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.privacy.adapters.in_memory import InMemoryConsentRepository, InMemoryDeletionRepository, InMemoryExportRepository
from careerpilot.privacy.adapters.sql import SqlConsentRepository, SqlDeletionRepository, SqlExportRepository
from careerpilot.privacy.ports import ConsentRepository, DeletionRepository, ExportRepository
from careerpilot.writing.adapters.in_memory import InMemoryWritingRepository
from careerpilot.writing.adapters.sql import SqlWritingRepository
from careerpilot.writing.ports import WritingRepository

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
    connections: ConnectionRepository = field(default_factory=InMemoryConnectionRepository)
    synced_messages: SyncedMessageRepository = field(default_factory=InMemorySyncedMessageRepository)
    calendar_events: CalendarEventRepository = field(default_factory=InMemoryCalendarEventRepository)
    circulars: CircularRepository = field(default_factory=InMemoryCircularRepository)
    holidays: HolidayRepository = field(default_factory=InMemoryHolidayRepository)
    gov_applications: GovApplicationRepository = field(default_factory=InMemoryGovApplicationRepository)
    exports: ExportRepository = field(default_factory=InMemoryExportRepository)
    deletions: DeletionRepository = field(default_factory=InMemoryDeletionRepository)
    consents: ConsentRepository = field(default_factory=InMemoryConsentRepository)
    writing_drafts: WritingRepository = field(default_factory=InMemoryWritingRepository)
    academic_records: AcademicRecordRepository = field(default_factory=InMemoryAcademicRecords)
    fee_records: FeeRecordRepository = field(default_factory=InMemoryFeeRecords)
    portal_records: PortalRecordRepository = field(default_factory=InMemoryPortalRecords)


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
        connections=SqlConnectionRepository(database, SystemClock()),
        synced_messages=SqlSyncedMessageRepository(database),
        calendar_events=SqlCalendarEventRepository(database),
        circulars=SqlCircularRepository(database, SystemClock()),
        holidays=SqlHolidayRepository(database, SystemClock()),
        gov_applications=SqlGovApplicationRepository(database, SystemClock()),
        exports=SqlExportRepository(database),
        deletions=SqlDeletionRepository(database),
        consents=SqlConsentRepository(database),
        writing_drafts=SqlWritingRepository(database, SystemClock()),
        academic_records=SqlAcademicRecords(database, SystemClock()),
        fee_records=SqlFeeRecords(database, SystemClock()),
        portal_records=SqlPortalRecords(database, SystemClock(), UuidIdGenerator()),
    )
