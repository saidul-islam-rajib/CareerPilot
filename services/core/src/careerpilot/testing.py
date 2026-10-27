import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import yaml

from careerpilot.administration.adapters.in_memory import (
    InMemoryAdminAccountRepository,
    InMemoryAuditLog,
    InMemoryDirectory,
    InMemoryPlatformSettingsRepository,
)
from careerpilot.administration.models import (
    AdminAccount,
    AdminApplicationRow,
    AdminOpportunityRow,
    AdminSourceRow,
    AdminUserRow,
    AuditEntry,
    PlatformSettings,
)
from careerpilot.administration.ports import AdminCredential, Directory
from careerpilot.candidate.adapters.in_memory import InMemoryAccountRepository, InMemoryOpportunityRepository, InMemoryWorkspaceRepository
from careerpilot.candidate.adapters.sql import SqlOpportunityRepository
from careerpilot.candidate.models import (
    ApplicationRecord,
    ApprovalDetail,
    OpportunityDetail,
    Preferences,
    Profile,
    SavedAnswer,
    SignInEvent,
    UserSummary,
)
from careerpilot.candidate.ports import Account, CandidateWorkspace, WorkspaceRepository
from careerpilot.discovery.adapters.in_memory import InMemoryListingCatalog
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.config import Settings, deep_merge, default_config_root, load_raw_config, repository_root
from careerpilot.platform.enums import UserAccountStatus
from careerpilot.platform.persistence import Database
from careerpilot.platform.security import PasswordHasher
from careerpilot.repositories import Repositories, RepositoryFactory, WorkspaceFactory, sql_repositories

FIXTURES = Path("services") / "core" / "tests" / "fixtures"
SAMPLE_DATA_FILE = FIXTURES / "sample-data.json"
DISCOVERY_FIXTURES_FILE = FIXTURES / "discovery" / "discovery.yaml"
SAMPLE_APP_ENV = "local"
ISO_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
OPERATION_KEYS = ("services", "notifications", "archivedCirculars", "userPhones", "secrets")


def shift_timestamps(value: Any, offset_seconds: float) -> Any:
    if isinstance(value, dict):
        return {key: shift_timestamps(item, offset_seconds) for key, item in cast("dict[str, Any]", value).items()}
    if isinstance(value, list):
        return [shift_timestamps(item, offset_seconds) for item in cast("list[Any]", value)]
    if isinstance(value, str) and ISO_TIMESTAMP.match(value):
        return iso(datetime.fromtimestamp(parse_iso(value).timestamp() + offset_seconds, parse_iso(value).tzinfo))
    return value


def load_sample_data(now: datetime, path: Path | None = None) -> dict[str, Any]:
    raw: dict[str, Any] = json.loads((path or repository_root() / SAMPLE_DATA_FILE).read_text(encoding="utf-8"))
    offset = now.timestamp() - parse_iso(str(raw["referenceNow"])).timestamp()
    shifted: dict[str, Any] = shift_timestamps(raw, offset)
    return shifted


def sample_settings(app_env: str = SAMPLE_APP_ENV) -> Settings:
    overlay = cast("dict[str, Any]", yaml.safe_load((repository_root() / DISCOVERY_FIXTURES_FILE).read_text(encoding="utf-8")))
    return Settings.model_validate(deep_merge(load_raw_config(app_env, default_config_root()), overlay))


def sample_accounts(user: dict[str, Any], hasher: PasswordHasher) -> list[Account]:
    return [
        Account(user=UserSummary.model_validate(a["user"]), password_hash=hasher.hash(str(a["password"])), status=UserAccountStatus.ACTIVE)
        for a in user["accounts"]
    ]


def sample_workspace(user: dict[str, Any]) -> CandidateWorkspace:
    return CandidateWorkspace(
        profile=Profile.model_validate(user["profile"]),
        preferences=Preferences.model_validate(user["settings"]),
        track_opportunities={k: list(v) for k, v in user["trackOpportunities"].items()},
        approvals=[ApprovalDetail.model_validate(a) for a in user["approvals"]],
        applications=[ApplicationRecord.model_validate(a) for a in user["applications"]],
        sign_in_events=[SignInEvent.model_validate(e) for e in user["signInEvents"]],
        last_checked_at=str(user["lastCheckedAt"]),
        saved_answers=[SavedAnswer.model_validate(a) for a in user.get("savedAnswers", [])],
    )


def sample_opportunities(user: dict[str, Any]) -> list[OpportunityDetail]:
    return [OpportunityDetail.model_validate(o) for o in user["opportunities"]]


def sample_admins(admin: dict[str, Any], hasher: PasswordHasher) -> list[AdminCredential]:
    return [
        AdminCredential(account=AdminAccount.model_validate(a["account"]), password_hash=hasher.hash(str(a["password"])))
        for a in admin["admins"]
    ]


def sample_audit(admin: dict[str, Any]) -> list[AuditEntry]:
    return [AuditEntry.model_validate(e) for e in admin["audit"]]


def sample_platform_settings(admin: dict[str, Any]) -> PlatformSettings:
    return PlatformSettings.model_validate(admin["settings"])


def fill_directory(directory: Directory, admin: dict[str, Any]) -> None:
    for user in admin["users"]:
        directory.save_user(AdminUserRow.model_validate(user))
    for application in admin["applications"]:
        directory.save_application(AdminApplicationRow.model_validate(application))
    for opportunity in admin["opportunities"]:
        directory.save_opportunity(AdminOpportunityRow.model_validate(opportunity))
    for source in admin["sources"]:
        directory.save_source(AdminSourceRow.model_validate(source))
    directory.save_operations({key: admin[key] for key in OPERATION_KEYS})


def save_sample_workspaces(workspaces: WorkspaceRepository, user: dict[str, Any]) -> None:
    for account in user["accounts"]:
        workspaces.save(str(account["user"]["id"]), sample_workspace(user))


def sample_repositories(sample: dict[str, Any]) -> RepositoryFactory:
    def build(hasher: PasswordHasher, empty: WorkspaceFactory, _defaults: PlatformSettings) -> Repositories:
        user, admin = sample["user"], sample["admin"]
        accounts = InMemoryAccountRepository()
        for account in sample_accounts(user, hasher):
            accounts.add(account)
        workspaces = InMemoryWorkspaceRepository(empty)
        save_sample_workspaces(workspaces, user)
        directory = InMemoryDirectory()
        fill_directory(directory, admin)
        return Repositories(
            accounts=accounts,
            opportunities=InMemoryOpportunityRepository(sample_opportunities(user)),
            workspaces=workspaces,
            admins=InMemoryAdminAccountRepository(sample_admins(admin, hasher)),
            platform=InMemoryPlatformSettingsRepository(sample_platform_settings(admin)),
            audit=InMemoryAuditLog(sample_audit(admin)),
            directory=directory,
            listings=InMemoryListingCatalog(),
        )

    return build


def sample_database_repositories(sample: dict[str, Any], database: Database) -> RepositoryFactory:
    def build(hasher: PasswordHasher, empty: WorkspaceFactory, defaults: PlatformSettings) -> Repositories:
        repositories = sql_repositories(database, empty, defaults)
        user, admin = sample["user"], sample["admin"]
        for account in sample_accounts(user, hasher):
            repositories.accounts.add(account)
        opportunities = repositories.opportunities
        assert isinstance(opportunities, SqlOpportunityRepository)
        for opportunity in sample_opportunities(user):
            opportunities.add(opportunity)
        save_sample_workspaces(repositories.workspaces, user)
        for credential in sample_admins(admin, hasher):
            repositories.admins.save(credential)
        repositories.platform.save(sample_platform_settings(admin))
        for entry in reversed(sample_audit(admin)):
            repositories.audit.append(entry)
        fill_directory(repositories.directory, admin)
        return repositories

    return build
