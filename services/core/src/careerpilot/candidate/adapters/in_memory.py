import copy
from collections.abc import Callable

from careerpilot.candidate.models import (
    OpportunityDetail,
)
from careerpilot.candidate.ports import Account, CandidateWorkspace
from careerpilot.platform.enums import UserAccountStatus


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

    def all_ids(self) -> list[str]:
        return list(self._by_id)


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
