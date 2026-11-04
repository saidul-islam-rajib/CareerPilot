from dataclasses import dataclass
from datetime import timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.errors import DomainError, ErrorCode, not_found, validation_error
from careerpilot.platform.files import FileLinkSigner, FileStorage
from careerpilot.privacy.archive import ArchiveBuilder
from careerpilot.privacy.enums import ExportFailure, ExportFormat, ExportKind, ExportStatus, ReportPeriod
from careerpilot.privacy.models import ExportRequest, ExportView
from careerpilot.privacy.ports import ExportRepository, JobRunner
from careerpilot.privacy.renderers import ExportFailed, ExportRenderer, RenderedFile, kind_formats
from careerpilot.privacy.reports import parse_date

OPEN_STATUSES = frozenset({ExportStatus.QUEUED, ExportStatus.RUNNING, ExportStatus.READY})
ERASED = b""


@dataclass(frozen=True)
class ExportSpec:
    kind: ExportKind
    format: ExportFormat
    period: ReportPeriod | None = None
    date: str | None = None
    application_id: str | None = None
    password: str | None = None


@dataclass(frozen=True)
class ExportContext:
    candidate: CandidateContext
    exports: ExportRepository
    storage: FileStorage
    links: FileLinkSigner
    renderer: ExportRenderer
    archive: ArchiveBuilder
    runner: JobRunner


class ExportService:
    def __init__(self, context: ExportContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.privacy.exports

    def request(self, user_id: str, spec: ExportSpec) -> ExportView:
        self._validate(user_id, spec)
        now = self._candidate.clock.now()
        record = ExportRequest(
            id=self._candidate.ids.next("exp"),
            user_id=user_id,
            kind=spec.kind,
            format=spec.format,
            status=ExportStatus.QUEUED,
            requested_at=iso(now),
            period=spec.period,
            date=spec.date,
            application_id=spec.application_id,
        )
        self._ctx.exports.save(record)
        self._ctx.runner.run(lambda: self.process(record.id))
        return self._view(self._ctx.exports.get(record.id) or record, "")

    def history(self, user_id: str, base_url: str) -> list[ExportView]:
        return [self._view(record, base_url) for record in self._ctx.exports.for_user(user_id)]

    def get(self, user_id: str, request_id: str, base_url: str) -> ExportView:
        record = self._ctx.exports.get(request_id)
        if record is None or record.user_id != user_id:
            raise not_found("export")
        return self._view(record, base_url)

    def process(self, request_id: str) -> None:
        record = self._ctx.exports.get(request_id)
        if record is None or record.status is not ExportStatus.QUEUED:
            return
        record.status = ExportStatus.RUNNING
        self._ctx.exports.save(record)
        try:
            produced = self._render(record)
        except ExportFailed as error:
            self._fail(record, error.failure)
        except Exception:
            self._fail(record, ExportFailure.UNEXPECTED)
        else:
            self._finish(record, produced)

    def process_pending(self) -> int:
        queued = self._ctx.exports.with_status(ExportStatus.QUEUED)
        for record in queued:
            self.process(record.id)
        return len(queued) + self.expire_due()

    def expire_due(self) -> int:
        now = self._candidate.clock.now()
        due = [r for r in self._ctx.exports.with_status(ExportStatus.READY) if r.expires_at and parse_iso(r.expires_at) <= now]
        for record in due:
            self.erase(record)
        return len(due)

    def erase(self, record: ExportRequest) -> None:
        if record.file_key:
            self._ctx.storage.put(record.file_key, ERASED)
        record.status = ExportStatus.EXPIRED
        record.file_key = None
        self._ctx.exports.save(record)

    def erase_all_for(self, user_id: str) -> int:
        records = [r for r in self._ctx.exports.for_user(user_id) if r.status is ExportStatus.READY]
        for record in records:
            self.erase(record)
        return len(records)

    def _validate(self, user_id: str, spec: ExportSpec) -> None:
        if spec.format not in kind_formats(self._config, spec.kind):
            raise validation_error("format")
        if spec.kind is ExportKind.REPORT:
            if spec.period is None:
                raise validation_error("period")
            parse_date(spec.date, self._candidate.clock.now().date())
        if spec.kind is ExportKind.APPLICATION:
            workspace = self._candidate.workspaces.get(user_id)
            if not any(a.id == spec.application_id for a in workspace.applications):
                raise not_found("application")
        if spec.kind is ExportKind.ARCHIVE:
            self._reauthenticate(user_id, spec.password)
        self._enforce_limits(user_id)

    def _reauthenticate(self, user_id: str, password: str | None) -> None:
        account = self._candidate.accounts.get(user_id)
        if account is None or not password or not self._candidate.hasher.verify(account.password_hash, password):
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)

    def _enforce_limits(self, user_id: str) -> None:
        now = self._candidate.clock.now()
        mine = self._ctx.exports.for_user(user_id)
        if sum(1 for r in mine if r.status in OPEN_STATUSES) >= self._config.max_open_per_user:
            raise validation_error("export_limit")
        since = now - timedelta(days=1)
        if sum(1 for r in mine if parse_iso(r.requested_at) >= since) >= self._config.max_per_day:
            raise validation_error("export_limit")

    def _render(self, record: ExportRequest) -> RenderedFile:
        workspace = self._candidate.workspaces.get(record.user_id)
        renderer = self._ctx.renderer
        if record.kind is ExportKind.APPLICATIONS:
            return renderer.applications(workspace, record.format, self._candidate.clock.now().strftime("%Y%m%d"))
        if record.kind is ExportKind.REPORT:
            return renderer.report(record.user_id, record, record.format)
        if record.kind is ExportKind.APPLICATION:
            return renderer.application(workspace, record.application_id or "")
        return self._ctx.archive.build(record.user_id)

    def _finish(self, record: ExportRequest, produced: RenderedFile) -> None:
        now = self._candidate.clock.now()
        extension = produced.name.rsplit(".", 1)[-1]
        key = f"{self._config.storage_prefix}/{record.user_id}/{record.id}.{extension}"
        self._ctx.storage.put(key, produced.content)
        record.status = ExportStatus.READY
        record.file_key = key
        record.file_name = produced.name
        record.size_bytes = len(produced.content)
        record.completed_at = iso(now)
        record.expires_at = iso(now + timedelta(hours=self._config.retention_hours))
        self._ctx.exports.save(record)

    def _fail(self, record: ExportRequest, failure: ExportFailure) -> None:
        record.status = ExportStatus.FAILED
        record.failure = failure
        record.completed_at = iso(self._candidate.clock.now())
        self._ctx.exports.save(record)

    def _link(self, record: ExportRequest, base_url: str) -> str | None:
        if record.status is not ExportStatus.READY or not (record.file_key and record.file_name and base_url):
            return None
        if record.expires_at and parse_iso(record.expires_at) <= self._candidate.clock.now():
            return None
        return self._ctx.links.link(base_url, record.file_key, record.file_name)

    def _view(self, record: ExportRequest, base_url: str) -> ExportView:
        return ExportView(
            id=record.id,
            kind=record.kind,
            format=record.format,
            status=record.status,
            requested_at=record.requested_at,
            period=record.period,
            date=record.date,
            application_id=record.application_id,
            completed_at=record.completed_at,
            expires_at=record.expires_at,
            file_name=record.file_name,
            size_bytes=record.size_bytes,
            download_url=self._link(record, base_url),
            failure=record.failure,
        )
