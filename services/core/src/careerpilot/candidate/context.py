from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.ports import AccountRepository, OpportunityRepository, WorkspaceRepository
from careerpilot.platform.clock import Clock, IdGenerator
from careerpilot.platform.config import Settings
from careerpilot.platform.security import PasswordHasher, TokenService

USER_AUDIENCE = "user"

ChangeListener = Callable[[str], object]


def ignore_change(_user_id: str) -> None:
    return None


@dataclass(frozen=True)
class CandidateContext:
    settings: Settings
    clock: Clock
    ids: IdGenerator
    accounts: AccountRepository
    opportunities: OpportunityRepository
    workspaces: WorkspaceRepository
    hasher: PasswordHasher
    tokens: TokenService
