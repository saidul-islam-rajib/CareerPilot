from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select

from careerpilot.administration.adapters.documents import operations_document
from careerpilot.administration.adapters.in_memory import (
    InMemoryAdminAccountRepository,
    InMemoryAuditLog,
    InMemoryDirectory,
    InMemoryPlatformSettingsRepository,
    admin_credentials_from_seed,
    audit_from_seed,
    platform_settings_from_seed,
)
from careerpilot.administration.adapters.sql import (
    SqlAdminAccountRepository,
    SqlAuditLog,
    SqlDirectory,
    SqlPlatformSettingsRepository,
)
from careerpilot.administration.models import AdminApplicationRow, AdminOpportunityRow, AdminSourceRow, AdminUserRow
from careerpilot.administration.ports import AdminAccountRepository, AuditLog, Directory, PlatformSettingsRepository
from careerpilot.candidate.adapters.in_memory import (
    InMemoryAccountRepository,
    InMemoryOpportunityRepository,
    InMemoryWorkspaceRepository,
    accounts_from_seed,
    opportunities_from_seed,
    workspace_from_seed,
)
from careerpilot.candidate.adapters.sql import SqlAccountRepository, SqlOpportunityRepository, SqlWorkspaceRepository, UserAccountRow
from careerpilot.candidate.ports import AccountRepository, CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.discovery.adapters.in_memory import InMemoryListingCatalog
from careerpilot.discovery.adapters.sql import SqlListingCatalog
from careerpilot.discovery.ports import ListingCatalog
from careerpilot.platform.persistence import Database
from careerpilot.platform.security import PasswordHasher


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


def _seed_workspaces(workspaces: WorkspaceRepository, user_seed: dict[str, Any]) -> None:
    for account in user_seed["accounts"]:
        workspaces.save(str(account["user"]["id"]), workspace_from_seed(user_seed))


def in_memory_repositories(demo: dict[str, Any], hasher: PasswordHasher, empty: Callable[[str], CandidateWorkspace]) -> Repositories:
    accounts = InMemoryAccountRepository()
    for account in accounts_from_seed(demo["user"], hasher):
        accounts.add(account)
    workspaces = InMemoryWorkspaceRepository(empty)
    _seed_workspaces(workspaces, demo["user"])
    return Repositories(
        accounts=accounts,
        opportunities=InMemoryOpportunityRepository(opportunities_from_seed(demo["user"])),
        workspaces=workspaces,
        admins=InMemoryAdminAccountRepository(admin_credentials_from_seed(demo["admin"], hasher)),
        platform=InMemoryPlatformSettingsRepository(platform_settings_from_seed(demo["admin"])),
        audit=InMemoryAuditLog(audit_from_seed(demo["admin"])),
        directory=InMemoryDirectory(demo["admin"]),
        listings=InMemoryListingCatalog(),
    )


def database_is_empty(database: Database) -> bool:
    with database.unit_of_work() as session:
        return (session.scalar(select(func.count()).select_from(UserAccountRow)) or 0) == 0


def seed_database(repositories: Repositories, directory: SqlDirectory, demo: dict[str, Any], hasher: PasswordHasher) -> None:
    user_seed, admin_seed = demo["user"], demo["admin"]
    for account in accounts_from_seed(user_seed, hasher):
        repositories.accounts.add(account)
    opportunities = repositories.opportunities
    assert isinstance(opportunities, SqlOpportunityRepository)
    for opportunity in opportunities_from_seed(user_seed):
        opportunities.add(opportunity)
    _seed_workspaces(repositories.workspaces, user_seed)
    for credential in admin_credentials_from_seed(admin_seed, hasher):
        repositories.admins.save(credential)
    repositories.platform.save(platform_settings_from_seed(admin_seed))
    for entry in reversed(audit_from_seed(admin_seed)):
        repositories.audit.append(entry)
    for user in admin_seed["users"]:
        directory.save_user(AdminUserRow.model_validate(user))
    for application in admin_seed["applications"]:
        directory.save_application(AdminApplicationRow.model_validate(application))
    for opportunity in admin_seed["opportunities"]:
        directory.save_opportunity(AdminOpportunityRow.model_validate(opportunity))
    for source in admin_seed["sources"]:
        directory.save_source(AdminSourceRow.model_validate(source))
    directory.save_operations(operations_document(admin_seed))


def sql_repositories(
    database: Database, demo: dict[str, Any], hasher: PasswordHasher, empty: Callable[[str], CandidateWorkspace]
) -> Repositories:
    directory = SqlDirectory(database)
    repositories = Repositories(
        accounts=SqlAccountRepository(database),
        opportunities=SqlOpportunityRepository(database),
        workspaces=SqlWorkspaceRepository(database, empty),
        admins=SqlAdminAccountRepository(database),
        platform=SqlPlatformSettingsRepository(database),
        audit=SqlAuditLog(database),
        directory=directory,
        listings=SqlListingCatalog(database),
    )
    if database_is_empty(database):
        seed_database(repositories, directory, demo, hasher)
    return repositories
