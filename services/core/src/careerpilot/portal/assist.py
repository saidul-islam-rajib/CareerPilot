from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.models import ApplicationRecord
from careerpilot.candidate.ports import CandidateWorkspace, WorkspaceRepository
from careerpilot.platform.errors import not_found
from careerpilot.portal.accounts import PortalAccounts
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.enums import Fact, Failure, HostPolicy, Intent, PageKind, RecordKind
from careerpilot.portal.facts import profile_facts
from careerpilot.portal.hosts import HostPolicies
from careerpilot.portal.mapping import has_any_term
from careerpilot.portal.models import (
    AttemptView,
    EvidenceLink,
    FillAnswer,
    FillCv,
    FillFact,
    FillPassword,
    FillPlan,
    PortalSettings,
)
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import RecordStore

SETTINGS_KEY = "settings"
SKIPPED_INTENTS = (Intent.DEMOGRAPHIC, Intent.ATTESTATION, Intent.CONSENT)
EVIDENCE_NAME = "evidence.png"
LinkBuilder = Callable[[str, str], str]


@dataclass(frozen=True)
class AssistContext:
    config: PortalsConfig
    records: PortalRecordRepository
    workspaces: WorkspaceRepository
    accounts: PortalAccounts
    hosts: HostPolicies


class AssistService:
    def __init__(self, context: AssistContext) -> None:
        self._ctx = context
        self._cfg = context.config
        self._attempts = RecordStore(context.records, RecordKind.ATTEMPT, AttemptView)
        self._settings = RecordStore(context.records, RecordKind.SETTINGS, PortalSettings)

    def plan(self, user_id: str, application_id: str, link: LinkBuilder) -> FillPlan:
        attempt = self._attempt(user_id, application_id)
        workspace = self._ctx.workspaces.get(user_id)
        application = self._application(workspace, application_id)
        policy = self._ctx.hosts.policy_of(attempt.host)
        email = self._email(user_id, attempt.host, workspace)
        return FillPlan(
            application_id=application_id,
            official_url=attempt.official_url,
            host=attempt.host,
            host_policy=policy,
            assist_allowed=policy is not HostPolicy.BLOCKED,
            account_email=email,
            has_password=self._ctx.accounts.find(user_id, attempt.host) is not None or bool(email),
            facts=self._facts(workspace),
            answers=self._answers(workspace),
            cover_letter=application.materials.cover_letter if application.materials else "",
            cover_letter_labels=self._cfg.intent_terms(Intent.COVER_LETTER),
            resume_labels=self._cfg.intent_terms(Intent.RESUME),
            cv=self._cv(workspace, application, link),
            confirmation_phrases=self._cfg.terms_for(PageKind.CONFIRMATION),
            skip_terms=self._skipped_terms(),
            captcha_selectors=self._cfg.captcha_selectors,
            scan_interval_ms=self._cfg.assist.scan_interval_ms,
            excerpt_chars=self._cfg.assist.excerpt_chars,
        )

    def password(self, user_id: str, application_id: str) -> FillPassword:
        attempt = self._attempt(user_id, application_id)
        existing = self._ctx.accounts.find(user_id, attempt.host)
        if existing is not None:
            return FillPassword(email=existing.email, password=self._ctx.accounts.password_of(existing))
        workspace = self._ctx.workspaces.get(user_id)
        email = self._email(user_id, attempt.host, workspace)
        if not email:
            raise not_found(Failure.NOT_FOUND.value)
        account, secret = self._ctx.accounts.create(user_id, attempt.host, attempt.host, email, attempt.official_url)
        return FillPassword(email=account.email, password=secret)

    def evidence_link(self, user_id: str, application_id: str, link: LinkBuilder) -> EvidenceLink:
        attempt = self._attempt(user_id, application_id)
        if not attempt.evidence_key:
            raise not_found(Failure.NOT_FOUND.value)
        return EvidenceLink(url=link(attempt.evidence_key, EVIDENCE_NAME))

    def _attempt(self, user_id: str, application_id: str) -> AttemptView:
        found = self._attempts.get(user_id, application_id)
        if found is None:
            raise not_found(Failure.NOT_FOUND.value)
        return found

    @staticmethod
    def _application(workspace: CandidateWorkspace, application_id: str) -> ApplicationRecord:
        found = next((a for a in workspace.applications if a.id == application_id), None)
        if found is None:
            raise not_found(Failure.NOT_FOUND.value)
        return found

    def _skipped_terms(self) -> list[str]:
        return [term for intent in SKIPPED_INTENTS for term in self._cfg.intent_terms(intent)]

    def _email(self, user_id: str, host: str, workspace: CandidateWorkspace) -> str:
        account = self._ctx.accounts.find(user_id, host)
        if account is not None:
            return account.email
        configured = (self._settings.get(user_id, SETTINGS_KEY) or PortalSettings()).permissions.account_email
        return configured or profile_facts(workspace.profile).get(Fact.EMAIL, "")

    def _facts(self, workspace: CandidateWorkspace) -> list[FillFact]:
        values = profile_facts(workspace.profile)
        return [
            FillFact(
                fact=entry.fact.value,
                value=values[entry.fact],
                autocomplete=entry.autocomplete,
                names=entry.names,
                labels=entry.labels,
            )
            for entry in self._cfg.facts
            if entry.fact in values
        ]

    def _answers(self, workspace: CandidateWorkspace) -> list[FillAnswer]:
        skipped = self._skipped_terms()
        return [
            FillAnswer(label=a.question, answer=a.answer)
            for a in workspace.saved_answers
            if a.deleted_at is None and not has_any_term(a.question, skipped)
        ]

    def _cv(self, workspace: CandidateWorkspace, application: ApplicationRecord, link: LinkBuilder) -> FillCv | None:
        if application.materials is None:
            return None
        cv = application.materials.cv
        documents = workspace.profile.active_documents()
        document = (
            next((d for d in documents if d.id == cv.document_id), None)
            if cv.document_id
            else next((d for d in documents if d.name == cv.name), None)
        )
        if document is None:
            return None
        return FillCv(name=document.current.file_name, url=link(document.current.key, document.current.file_name))
