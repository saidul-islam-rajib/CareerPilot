from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from careerpilot.candidate.models import ApplicationRecord, Track
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.discovery.text import normalized
from careerpilot.platform.clock import parse_iso

ROLE_SEPARATOR = "|"


@dataclass(frozen=True)
class UserScope:
    home_country: str
    excluded_countries: frozenset[str]
    excluded_organizations: frozenset[str]
    recent_roles: frozenset[str]


def home_country(workspace: CandidateWorkspace, default: str) -> str:
    return workspace.profile.country_code or default


def ordered_tracks(tracks: list[Track], lead_kinds: list[str]) -> list[Track]:
    ranked = sorted(tracks, key=lambda track: (track.kind not in lead_kinds, track.position))
    return [track.model_copy(update={"position": index + 1}) for index, track in enumerate(ranked)]


def role_key(organization: str, title: str) -> str:
    return f"{normalized(organization)}{ROLE_SEPARATOR}{normalized(title)}"


def is_excluded(organization: str, excluded: Iterable[str]) -> bool:
    name = f" {normalized(organization)} "
    return any(f" {key} " in name for key in map(normalized, excluded) if key)


def company_key(organization: str) -> str:
    return normalized(organization)


@dataclass
class CompanyQuota:
    limit: int
    shown: Counter[str] = field(default_factory=Counter[str])

    def admit(self, organization: str) -> bool:
        key = company_key(organization)
        if self.shown[key] >= self.limit:
            return False
        self.shown[key] += 1
        return True


def applied_at(application: ApplicationRecord) -> str:
    return application.applied_at or (application.timeline[0].at if application.timeline else application.updated_at)


def recent_roles(workspace: CandidateWorkspace, now: datetime, days: int) -> frozenset[str]:
    since = now - timedelta(days=days)
    return frozenset(
        role_key(application.opportunity.organization, application.opportunity.title)
        for application in workspace.applications
        if parse_iso(applied_at(application)) >= since
    )


def user_scope(workspace: CandidateWorkspace, default_country: str, now: datetime, cooldown_days: int) -> UserScope:
    return UserScope(
        home_country=home_country(workspace, default_country),
        excluded_countries=frozenset(workspace.preferences.excluded_countries),
        excluded_organizations=frozenset(workspace.preferences.excluded_organizations),
        recent_roles=recent_roles(workspace, now, cooldown_days),
    )
