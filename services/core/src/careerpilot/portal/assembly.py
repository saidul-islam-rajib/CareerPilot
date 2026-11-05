from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.services.answers import AnswerService
from careerpilot.candidate.services.applications import ApplicationService
from careerpilot.candidate.services.submission import SubmissionService
from careerpilot.integrations.connections import ConnectionService
from careerpilot.integrations.ports import TokenCipher
from careerpilot.messaging.notifications import NotificationService
from careerpilot.platform.files import FileStorage
from careerpilot.portal.accounts import AccountsContext, PortalAccounts
from careerpilot.portal.driver import BrowserSession
from careerpilot.portal.hosts import HostPolicies, HostsContext
from careerpilot.portal.readiness import ReadinessChecker, ReadinessContext
from careerpilot.portal.runner import PortalRunner, RunnerContext
from careerpilot.portal.service import PortalContext, PortalService
from careerpilot.portal.throttle import HostThrottle
from careerpilot.portal.verification import VerificationFetcher
from careerpilot.repositories import Repositories


@dataclass(frozen=True)
class PortalServices:
    service: PortalService
    runner: PortalRunner
    readiness: ReadinessChecker
    hosts: HostPolicies
    accounts: PortalAccounts
    user_lookup: Callable[[str], str | None]


@dataclass(frozen=True)
class PortalParts:
    candidate: CandidateContext
    repos: Repositories
    storage: FileStorage
    notifications: NotificationService
    submissions: SubmissionService
    connections: ConnectionService
    answers: AnswerService
    applications: ApplicationService
    browser: BrowserSession
    live: Callable[[], bool]
    vault: TokenCipher


def build_portal(parts: PortalParts) -> PortalServices:
    candidate = parts.candidate
    config = candidate.settings.portals
    records = parts.repos.portal_records
    accounts = PortalAccounts(AccountsContext(config, candidate.clock, candidate.ids, records, parts.vault))
    hosts = HostPolicies(HostsContext(config, candidate.clock, records))
    throttle = HostThrottle(config.throttle)
    runner = PortalRunner(
        RunnerContext(
            config=config,
            clock=candidate.clock,
            ids=candidate.ids,
            records=records,
            workspaces=candidate.workspaces,
            opportunities=candidate.opportunities,
            storage=parts.storage,
            accounts=accounts,
            hosts=hosts,
            throttle=throttle,
            browser=parts.browser,
            verifier=VerificationFetcher(config.verification, candidate.clock, parts.connections),
            policy=parts.submissions.policy,
            live=parts.live,
            hold_of=parts.submissions.hold_of,
            notify=parts.notifications.notify,
            on_status=parts.notifications.application_changed,
        )
    )
    readiness = ReadinessChecker(
        ReadinessContext(config, candidate.clock, candidate.ids, records, candidate.workspaces, accounts, hosts, throttle, parts.browser)
    )
    service = PortalService(
        PortalContext(
            config=config,
            clock=candidate.clock,
            ids=candidate.ids,
            records=records,
            workspaces=candidate.workspaces,
            accounts=accounts,
            hosts=hosts,
            answers=parts.answers,
            applications=parts.applications,
            live=parts.live,
            mail_connected=lambda user_id: parts.connections.status(user_id).mail_access,
        )
    )
    return PortalServices(service, runner, readiness, hosts, accounts, lambda email: account.id if (account := parts.repos.accounts.find_by_email(email)) else None)
