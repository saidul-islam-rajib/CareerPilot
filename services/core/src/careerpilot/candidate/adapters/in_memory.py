import copy
from collections.abc import Callable
from typing import Any

from careerpilot.candidate.models import (
    ApplicationRecord,
    ApprovalDetail,
    OpportunityDetail,
    Preferences,
    Profile,
    SignInEvent,
    UserSummary,
)
from careerpilot.candidate.ports import Account, CandidateWorkspace
from careerpilot.platform.enums import UserAccountStatus
from careerpilot.platform.security import PasswordHasher


class InMemoryAccountRepository:
    def __init__(self) -> None:
        self._by_id: dict[str, Account] = {}

    def find_by_email(self, email: str) -> Account | None:
        normalized = email.strip().lower()
        return next((copy.deepcopy(a) for a in self._by_id.values() if a.user.email.lower() == normalized), None)

    def get(self, user_id: str) -> Account | None:
        account = self._by_id.get(user_id)
        return copy.deepcopy(account) if account else None

    def add(self, account: Account) -> None:
        self._by_id[account.user.id] = copy.deepcopy(account)

    def save(self, account: Account) -> None:
        self._by_id[account.user.id] = copy.deepcopy(account)

    def active_ids(self) -> list[str]:
        return [user_id for user_id, account in self._by_id.items() if account.status is UserAccountStatus.ACTIVE]


class InMemoryOpportunityRepository:
    def __init__(self, opportunities: list[OpportunityDetail]) -> None:
        self._by_id = {o.id: o for o in opportunities}

    def get(self, opportunity_id: str) -> OpportunityDetail | None:
        found = self._by_id.get(opportunity_id)
        return found.model_copy(deep=True) if found else None

    def list_all(self) -> list[OpportunityDetail]:
        return [o.model_copy(deep=True) for o in self._by_id.values()]

    def save(self, opportunity: OpportunityDetail) -> None:
        self._by_id[opportunity.id] = opportunity.model_copy(deep=True)


class InMemoryWorkspaceRepository:
    def __init__(self, empty_workspace: Callable[[str], CandidateWorkspace]) -> None:
        self._by_user: dict[str, CandidateWorkspace] = {}
        self._empty = empty_workspace

    def get(self, user_id: str) -> CandidateWorkspace:
        if user_id not in self._by_user:
            self._by_user[user_id] = self._empty(user_id)
        return copy.deepcopy(self._by_user[user_id])

    def save(self, user_id: str, workspace: CandidateWorkspace) -> None:
        self._by_user[user_id] = copy.deepcopy(workspace)


def workspace_from_seed(user_seed: dict[str, Any]) -> CandidateWorkspace:
    return CandidateWorkspace(
        profile=Profile.model_validate(user_seed["profile"]),
        preferences=Preferences.model_validate(user_seed["settings"]),
        track_opportunities={k: list(v) for k, v in user_seed["trackOpportunities"].items()},
        approvals=[ApprovalDetail.model_validate(a) for a in user_seed["approvals"]],
        applications=[ApplicationRecord.model_validate(a) for a in user_seed["applications"]],
        sign_in_events=[SignInEvent.model_validate(e) for e in user_seed["signInEvents"]],
        last_checked_at=str(user_seed["lastCheckedAt"]),
    )


def accounts_from_seed(user_seed: dict[str, Any], hasher: PasswordHasher) -> list[Account]:
    return [
        Account(user=UserSummary.model_validate(a["user"]), password_hash=hasher.hash(str(a["password"])), status=UserAccountStatus.ACTIVE)
        for a in user_seed["accounts"]
    ]


def opportunities_from_seed(user_seed: dict[str, Any]) -> list[OpportunityDetail]:
    return [OpportunityDetail.model_validate(o) for o in user_seed["opportunities"]]
