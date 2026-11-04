from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.integrations.connections import ConnectionService
from careerpilot.platform.email_delivery import Courier
from careerpilot.platform.files import FileLinkSigner, FileStorage
from careerpilot.privacy.admin import AdminPrivacy
from careerpilot.privacy.archive import ArchiveBuilder, ArchiveSources
from careerpilot.privacy.consents import ConsentContext, ConsentService
from careerpilot.privacy.deletion import DeletionContext, DeletionService
from careerpilot.privacy.exports import ExportContext, ExportService
from careerpilot.privacy.ports import JobRunner
from careerpilot.privacy.renderers import ExportRenderer
from careerpilot.privacy.reports import ReportService
from careerpilot.repositories import Repositories

SCRUB_REASON_FIELDS = {"ip": "", "device": "", "approximate_location": ""}


@dataclass(frozen=True)
class PrivacyParts:
    candidate: CandidateContext
    repos: Repositories
    storage: FileStorage
    links: FileLinkSigner
    courier: Courier
    connections: ConnectionService
    reports: ReportService
    empty_workspace: Callable[[str], CandidateWorkspace]
    runner: JobRunner
    grace_days: Callable[[], int]


@dataclass(frozen=True)
class PrivacyServices:
    reports: ReportService
    exports: ExportService
    deletion: DeletionService
    consents: ConsentService
    admin: AdminPrivacy


def session_scrubber(repos: Repositories) -> Callable[[str], None]:
    def scrub(user_id: str) -> None:
        for session in repos.directory.sessions():
            if session.user_id == user_id:
                repos.directory.save_session(session.model_copy(update=SCRUB_REASON_FIELDS))

    return scrub


def build_privacy(parts: PrivacyParts) -> PrivacyServices:
    candidate = parts.candidate
    repos = parts.repos
    config = candidate.settings.privacy
    consents = ConsentService(ConsentContext(candidate=candidate, consents=repos.consents))
    sources = ArchiveSources(
        consents=repos.consents.for_user,
        deletions=repos.deletions.latest,
        connections=parts.connections.views,
    )
    exports = ExportService(
        ExportContext(
            candidate=candidate,
            exports=repos.exports,
            storage=parts.storage,
            links=parts.links,
            renderer=ExportRenderer(config.exports, parts.reports, config.reports.other_track),
            archive=ArchiveBuilder(candidate, parts.storage, config.exports, sources),
            runner=parts.runner,
        )
    )
    deletion = DeletionService(
        DeletionContext(
            candidate=candidate,
            deletions=repos.deletions,
            courier=parts.courier,
            storage=parts.storage,
            devices=repos.push_devices,
            messages=repos.messages,
            disconnect=parts.connections.disconnect,
            erase_exports=exports.erase_all_for,
            scrub_sessions=session_scrubber(repos),
            empty_workspace=parts.empty_workspace,
            grace_days=parts.grace_days,
        )
    )
    admin = AdminPrivacy(repos.exports, repos.deletions, consents, repos.accounts, config.admin_page_size)
    return PrivacyServices(parts.reports, exports, deletion, consents, admin)
