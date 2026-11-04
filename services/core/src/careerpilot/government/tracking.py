import hashlib
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from pydantic import Field

from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.candidate.services.profile import Upload
from careerpilot.government.circulars import CircularService
from careerpilot.government.eligibility import EligibilityChecker, FactReader
from careerpilot.government.models import (
    ApplicantCopy,
    Circular,
    CopyView,
    DeadlineNote,
    FeeRecord,
    GovApplication,
    GovApplicationView,
    GuideStep,
    StageRecord,
    UpcomingItem,
)
from careerpilot.government.ports import CircularRepository, GovApplicationRepository
from careerpilot.government.workdays import WorkCalendar
from careerpilot.integrations.ports import TokenCipher
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.config import GovernmentConfig
from careerpilot.platform.enums import (
    DeadlineSubject,
    Eligibility,
    EvidenceSource,
    FeeStatus,
    FeeUrgency,
    GovApplicationStatus,
    GovStage,
    GuideStepKind,
    PaymentMethod,
    SecretKind,
    StageStatus,
)
from careerpilot.platform.errors import conflict, not_found, validation_error
from careerpilot.platform.files import EXTENSIONS, FileLinkSigner, FileStorage, detect_content_type
from careerpilot.platform.model import CamelModel

APPLICATION_PREFIX = "gap"
STAGE_PREFIX = "stg"
COPY_PREFIX = "cpy"
FILE_PREFIX = "f"
FOLDER = "gov"
WITHDRAW_REASON = "withdrawn by the user"
EVIDENCE_REQUIRED = "evidence_required"
FEE_OPEN = frozenset({FeeStatus.DUE, FeeStatus.UNCONFIRMED})
STAGE_OPEN = frozenset({StageStatus.EXPECTED, StageStatus.SCHEDULED, StageStatus.RESCHEDULED})
CONCLUDING = frozenset({StageStatus.PASSED, StageStatus.FAILED})
SUBMITTED_STATES = frozenset({GovApplicationStatus.SUBMITTED, GovApplicationStatus.CONFIRMED})


class FeeUpdate(CamelModel):
    status: FeeStatus | None = None
    method: PaymentMethod | None = None
    payment_deadline: datetime | None = None
    evidence_note: str | None = None
    transaction_id: str | None = None


class StageInput(CamelModel):
    stage: GovStage
    status: StageStatus = StageStatus.EXPECTED
    on: date | None = None
    time: str | None = None
    venue: str = ""
    note: str = ""
    notice_url: str = ""
    source: EvidenceSource = EvidenceSource.USER_ENTRY


class SecretsInput(CamelModel):
    values: dict[SecretKind, str] = Field(default_factory=dict[SecretKind, str])


@dataclass(frozen=True)
class TrackingContext:
    config: GovernmentConfig
    clock: Clock
    ids: IdGenerator
    circulars: CircularRepository
    applications: GovApplicationRepository
    workspaces: WorkspaceRepository
    calendar: WorkCalendar
    cipher: TokenCipher
    storage: FileStorage
    links: FileLinkSigner
    circular_service: CircularService


class GovernmentTracking:
    def __init__(self, context: TrackingContext) -> None:
        self._ctx = context
        self._cfg = context.config
        self._checker = EligibilityChecker(context.config)
        self._facts = FactReader(context.config)

    def _now(self) -> datetime:
        return self._ctx.clock.now()

    def _load(self, user_id: str, application_id: str) -> GovApplication:
        found = self._ctx.applications.get(user_id, application_id)
        if found is None:
            raise not_found("application")
        return found

    def _circular(self, application: GovApplication) -> Circular:
        circular = self._ctx.circulars.get(application.circular_id)
        if circular is None:
            raise not_found("circular")
        return circular

    def list_for(self, user_id: str, base_url: str) -> list[GovApplicationView]:
        return [self._view(a, base_url) for a in self._ctx.applications.for_user(user_id)]

    def get(self, user_id: str, application_id: str, base_url: str) -> GovApplicationView:
        return self._view(self._load(user_id, application_id), base_url)

    def start(self, user_id: str, circular_id: str, post_ids: list[str]) -> GovApplication:
        circular = self._ctx.circular_service.published(circular_id)
        wanted = list(dict.fromkeys(post_ids))
        known = {post.id: post for post in circular.posts}
        if not wanted or any(post_id not in known for post_id in wanted):
            raise validation_error("posts")
        if any(
            a.circular_id == circular_id and a.status is not GovApplicationStatus.WITHDRAWN
            for a in self._ctx.applications.for_user(user_id)
        ):
            raise conflict("already_tracking")
        amounts = [amount for i in wanted if (amount := known[i].fee_amount) is not None]
        fee_amount = max(amounts) if amounts else (circular.fee.amount if circular.fee else None)
        fee = FeeRecord(
            amount=fee_amount,
            currency=self._cfg.currency,
            status=FeeStatus.DUE if fee_amount else FeeStatus.NOT_REQUIRED,
            method=circular.fee.method if circular.fee else None,
        )
        application = GovApplication(
            id=self._ctx.ids.next(APPLICATION_PREFIX),
            user_id=user_id,
            circular_id=circular_id,
            circular_version=circular.version,
            post_ids=wanted,
            fee=fee,
            created_at=iso(self._now()),
        )
        if circular.closes_on is not None:
            application.stages.append(
                StageRecord(
                    id=self._ctx.ids.next(STAGE_PREFIX),
                    stage=GovStage.APPLICATION,
                    status=StageStatus.SCHEDULED,
                    on=circular.closes_on,
                    source=EvidenceSource.OFFICIAL_NOTICE,
                    notice_url=circular.notice_url,
                )
            )
        self._ctx.applications.save(application)
        return application

    def withdraw(self, user_id: str, application_id: str) -> None:
        application = self._load(user_id, application_id)
        application.status = GovApplicationStatus.WITHDRAWN
        self._ctx.applications.save(application)
        self._ctx.applications.remove(user_id, application_id, WITHDRAW_REASON)

    def mark_submitted(self, user_id: str, application_id: str) -> GovApplication:
        application = self._load(user_id, application_id)
        if application.status is not GovApplicationStatus.PREPARING:
            raise conflict("not_preparing")
        now = self._now()
        application.status = GovApplicationStatus.SUBMITTED
        application.submitted_at = iso(now)
        circular = self._circular(application)
        window = circular.fee.window_hours if circular.fee else None
        if application.fee.status is FeeStatus.DUE and window and application.fee.payment_deadline is None:
            application.fee.payment_deadline = now + timedelta(hours=window)
        self._ctx.applications.save(application)
        return application

    def confirm(self, user_id: str, application_id: str) -> GovApplication:
        application = self._load(user_id, application_id)
        if application.status is not GovApplicationStatus.SUBMITTED:
            raise conflict("not_submitted")
        if not application.copies and SecretKind.APPLICATION_ID not in application.sealed:
            raise validation_error(EVIDENCE_REQUIRED)
        application.status = GovApplicationStatus.CONFIRMED
        self._ctx.applications.save(application)
        return application

    def update_fee(self, user_id: str, application_id: str, change: FeeUpdate) -> GovApplication:
        application = self._load(user_id, application_id)
        fee = application.fee
        if fee.status is FeeStatus.NOT_REQUIRED and change.status is not None:
            raise validation_error("fee_not_required")
        if change.method is not None:
            fee.method = change.method
        if change.payment_deadline is not None:
            fee.payment_deadline = change.payment_deadline
        if change.evidence_note is not None:
            fee.evidence_note = change.evidence_note.strip()
        if change.transaction_id is not None:
            self._set_secret(application, SecretKind.TRANSACTION_ID, change.transaction_id)
        if change.status is not None:
            self._apply_fee_status(application, change.status)
        self._ctx.applications.save(application)
        return application

    def _apply_fee_status(self, application: GovApplication, status: FeeStatus) -> None:
        fee = application.fee
        if status is FeeStatus.PAID:
            if not (fee.evidence_note or SecretKind.TRANSACTION_ID in application.sealed):
                raise validation_error(EVIDENCE_REQUIRED)
            fee.confirmed_at = iso(self._now())
        else:
            fee.confirmed_at = None
        fee.status = status

    def _set_secret(self, application: GovApplication, kind: SecretKind, value: str) -> None:
        clean = value.strip()
        if len(clean) > self._cfg.limits.max_secret_chars:
            raise validation_error("secret_too_long")
        if clean:
            application.sealed[kind] = self._ctx.cipher.seal(clean)
        else:
            application.sealed.pop(kind, None)

    def set_secrets(self, user_id: str, application_id: str, values: dict[SecretKind, str]) -> GovApplication:
        application = self._load(user_id, application_id)
        for kind, value in values.items():
            self._set_secret(application, kind, value)
        self._ctx.applications.save(application)
        return application

    def reveal_secrets(self, user_id: str, application_id: str) -> dict[SecretKind, str]:
        application = self._load(user_id, application_id)
        return {kind: self._ctx.cipher.unseal(sealed) for kind, sealed in application.sealed.items()}

    def add_stage(self, user_id: str, application_id: str, data: StageInput) -> GovApplication:
        application = self._load(user_id, application_id)
        if len(application.stages) >= self._cfg.limits.max_stages:
            raise validation_error("too_many")
        self._check_stage(data)
        application.stages.append(StageRecord(id=self._ctx.ids.next(STAGE_PREFIX), **data.model_dump()))
        self._ctx.applications.save(application)
        return application

    def update_stage(self, user_id: str, application_id: str, stage_id: str, data: StageInput) -> GovApplication:
        application = self._load(user_id, application_id)
        index = next((i for i, s in enumerate(application.stages) if s.id == stage_id), None)
        if index is None:
            raise not_found("stage")
        self._check_stage(data)
        application.stages[index] = StageRecord(id=stage_id, **data.model_dump())
        self._ctx.applications.save(application)
        return application

    def remove_stage(self, user_id: str, application_id: str, stage_id: str) -> GovApplication:
        application = self._load(user_id, application_id)
        if not any(s.id == stage_id for s in application.stages):
            raise not_found("stage")
        application.stages = [s for s in application.stages if s.id != stage_id]
        self._ctx.applications.save(application)
        return application

    @staticmethod
    def _check_stage(data: StageInput) -> None:
        if data.status in CONCLUDING and data.source is EvidenceSource.OFFICIAL_NOTICE and not data.notice_url.strip():
            raise validation_error(EVIDENCE_REQUIRED)

    def add_copy(self, user_id: str, application_id: str, upload: Upload) -> GovApplication:
        application = self._load(user_id, application_id)
        limits = self._cfg.limits
        if len(application.copies) >= limits.max_copies:
            raise validation_error("too_many")
        if not upload.data:
            raise validation_error("file_empty")
        if len(upload.data) > limits.copy_max_bytes:
            raise validation_error("file_too_large")
        content_type = detect_content_type(upload.data)
        if content_type is None or content_type not in limits.copy_types:
            raise validation_error("file_type")
        key = f"{FOLDER}/{user_id}/{application_id}/{self._ctx.ids.next(FILE_PREFIX).lower()}.{EXTENSIONS[content_type]}"
        self._ctx.storage.put(key, upload.data)
        application.copies.append(
            ApplicantCopy(
                id=self._ctx.ids.next(COPY_PREFIX),
                key=key,
                file_name=upload.file_name.strip()[: limits.max_name_chars] or key.rsplit("/", 1)[-1],
                content_type=content_type,
                size_bytes=len(upload.data),
                uploaded_at=iso(self._now()),
                sha256=hashlib.sha256(upload.data).hexdigest(),
            )
        )
        self._ctx.applications.save(application)
        return application

    def remove_copy(self, user_id: str, application_id: str, copy_id: str) -> GovApplication:
        application = self._load(user_id, application_id)
        if not any(c.id == copy_id for c in application.copies):
            raise not_found("copy")
        application.copies = [c for c in application.copies if c.id != copy_id]
        self._ctx.applications.save(application)
        return application

    def guide(self, user_id: str, application_id: str) -> list[GuideStep]:
        application = self._load(user_id, application_id)
        circular = self._circular(application)
        profile = self._ctx.workspaces.get(user_id).profile
        facts = self._facts.read(profile)
        posts = [p for p in circular.posts if p.id in application.post_ids]
        eligible = all(self._checker.check(circular, p, facts).overall is Eligibility.MET for p in posts)
        submitted = application.status in SUBMITTED_STATES
        fee = application.fee.status
        done: dict[GuideStepKind, bool] = {
            GuideStepKind.CHECK_ELIGIBILITY: eligible,
            GuideStepKind.PREPARE_PHOTO_SIGNATURE: profile.has_photo() and bool(profile.signature_url),
            GuideStepKind.OPEN_OFFICIAL_SITE: submitted,
            GuideStepKind.COMPLETE_VERIFICATION: submitted,
            GuideStepKind.SUBMIT_FORM: submitted,
            GuideStepKind.SAVE_APPLICANT_COPY: bool(application.copies),
            GuideStepKind.PAY_FEE: fee is not FeeStatus.DUE,
            GuideStepKind.CONFIRM_PAYMENT: fee in {FeeStatus.PAID, FeeStatus.NOT_REQUIRED},
        }
        link = circular.apply_url
        return [
            GuideStep(kind=s.kind, actor=s.actor, done=done[s.kind], link=link if s.kind is GuideStepKind.OPEN_OFFICIAL_SITE else "")
            for s in self._cfg.guide.steps
        ]

    def upcoming(self, user_id: str) -> list[UpcomingItem]:
        today = self._ctx.calendar.local_date(self._now())
        last = today + timedelta(days=self._cfg.limits.upcoming_days)
        items: list[UpcomingItem] = []
        for application in self._ctx.applications.for_user(user_id):
            if application.status is GovApplicationStatus.WITHDRAWN:
                continue
            circular = self._ctx.circulars.get(application.circular_id)
            if circular is not None:
                items.extend(self._upcoming_of(application, circular, today, last))
        return sorted(items, key=lambda item: item.on)

    def _upcoming_of(self, application: GovApplication, circular: Circular, today: date, last: date) -> list[UpcomingItem]:
        found: list[UpcomingItem] = []

        def add(subject: DeadlineSubject, on: date, note: DeadlineNote, stage: GovStage | None = None) -> None:
            if today <= on <= last:
                found.append(
                    UpcomingItem(
                        application_id=application.id,
                        circular_title=circular.title,
                        subject=subject,
                        stage=stage,
                        on=on,
                        note=note,
                    )
                )

        if application.status is GovApplicationStatus.PREPARING and circular.closes_on is not None:
            add(
                DeadlineSubject.APPLICATION_CLOSE, circular.closes_on, self._ctx.circular_service.close_note(circular) or self._empty_note()
            )
        fee = application.fee
        if fee.status in FEE_OPEN and fee.payment_deadline is not None:
            due = self._ctx.calendar.local_date(fee.payment_deadline)
            note = self._ctx.calendar.note(DeadlineSubject.FEE_PAYMENT, due, self._ctx.calendar.local_time(fee.payment_deadline))
            add(DeadlineSubject.FEE_PAYMENT, due, note)
        for stage in application.stages:
            if stage.on is not None and stage.status in STAGE_OPEN and stage.stage is not GovStage.APPLICATION:
                add(DeadlineSubject.STAGE, stage.on, self._ctx.calendar.note(DeadlineSubject.STAGE, stage.on), stage.stage)
        return found

    def _empty_note(self) -> DeadlineNote:
        today = self._ctx.calendar.local_date(self._now())
        return self._ctx.calendar.note(DeadlineSubject.APPLICATION_CLOSE, today)

    def _urgency(self, fee: FeeRecord) -> tuple[FeeUrgency, DeadlineNote | None]:
        if fee.status not in FEE_OPEN or fee.payment_deadline is None:
            return FeeUrgency.NONE, None
        calendar = self._ctx.calendar
        note = calendar.note(
            DeadlineSubject.FEE_PAYMENT, calendar.local_date(fee.payment_deadline), calendar.local_time(fee.payment_deadline)
        )
        now = self._now()
        if fee.payment_deadline < now:
            return FeeUrgency.OVERDUE, note
        soon = now + timedelta(days=self._cfg.fee.due_soon_days)
        return (FeeUrgency.DUE_SOON if fee.payment_deadline <= soon else FeeUrgency.OK), note

    def _view(self, application: GovApplication, base_url: str) -> GovApplicationView:
        circular = self._circular(application)
        urgency, note = self._urgency(application.fee)
        titles = [p.title for p in circular.posts if p.id in application.post_ids]
        return GovApplicationView(
            id=application.id,
            circular_id=circular.id,
            circular_title=circular.title,
            authority=circular.authority,
            circular_version=application.circular_version,
            post_ids=application.post_ids,
            post_titles=titles,
            status=application.status,
            submitted_at=application.submitted_at,
            fee=application.fee,
            fee_urgency=urgency,
            fee_note=note,
            stages=sorted(application.stages, key=lambda s: (s.on is None, s.on or date.max)),
            copies=[
                CopyView(
                    id=c.id,
                    file_name=c.file_name,
                    content_type=c.content_type,
                    size_bytes=c.size_bytes,
                    uploaded_at=c.uploaded_at,
                    url=self._ctx.links.link(base_url, c.key, c.file_name),
                )
                for c in application.copies
            ],
            secrets_present=sorted(application.sealed, key=lambda k: k.value),
            closes_on=circular.closes_on,
            apply_url=circular.apply_url,
        )
