from dataclasses import dataclass, field
from typing import Protocol

from careerpilot.candidate.models import (
    ApplicationRecord,
    ApprovalDetail,
    OpportunityDetail,
    OpportunityMatch,
    Preferences,
    Profile,
    SignInEvent,
    UserSummary,
)
from careerpilot.platform.enums import OpportunityDecision, UserAccountStatus


@dataclass
class Account:
    user: UserSummary
    password_hash: str
    status: UserAccountStatus
    consent_terms_version: str | None = None
    consent_privacy_version: str | None = None


@dataclass
class CandidateWorkspace:
    profile: Profile
    preferences: Preferences
    track_opportunities: dict[str, list[str]]
    approvals: list[ApprovalDetail]
    applications: list[ApplicationRecord]
    sign_in_events: list[SignInEvent]
    last_checked_at: str
    decisions: dict[str, OpportunityDecision] = field(default_factory=dict[str, OpportunityDecision])
    deletion_scheduled_for: str | None = None
    matches: dict[str, OpportunityMatch] = field(default_factory=dict[str, OpportunityMatch])
    last_digest_on: str | None = None


class AccountRepository(Protocol):
    def find_by_email(self, email: str) -> Account | None: ...

    def get(self, user_id: str) -> Account | None: ...

    def add(self, account: Account) -> None: ...

    def save(self, account: Account) -> None: ...

    def active_ids(self) -> list[str]: ...


class OpportunityRepository(Protocol):
    def get(self, opportunity_id: str) -> OpportunityDetail | None: ...

    def list_all(self) -> list[OpportunityDetail]: ...

    def save(self, opportunity: OpportunityDetail) -> None: ...


class WorkspaceRepository(Protocol):
    def get(self, user_id: str) -> CandidateWorkspace: ...

    def save(self, user_id: str, workspace: CandidateWorkspace) -> None: ...
