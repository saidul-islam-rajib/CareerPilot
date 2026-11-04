from dataclasses import dataclass

from careerpilot.candidate.models import ApplicationRecord
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.enums import OutcomeStatus, SubmissionStatus
from careerpilot.platform.messages import translate
from careerpilot.privacy.config import ExportsConfig
from careerpilot.privacy.documents import render_csv, render_pdf
from careerpilot.privacy.enums import ExportFailure, ExportFormat, ExportKind, ReportBucket
from careerpilot.privacy.models import ActivityReport, ExportRequest
from careerpilot.privacy.reports import ReportService, track_label

CSV_TYPE = "text/csv"
PDF_TYPE = "application/pdf"
ZIP_TYPE = "application/zip"
CONTENT_TYPES = {ExportFormat.CSV: CSV_TYPE, ExportFormat.PDF: PDF_TYPE, ExportFormat.ZIP: ZIP_TYPE}
NO_VALUE = ""
BLANK_LINE = ""
INDENT = "  "
FILE_STEM = "careerpilot"


class ExportFailed(Exception):
    def __init__(self, failure: ExportFailure) -> None:
        super().__init__(failure.value)
        self.failure = failure


@dataclass(frozen=True)
class RenderedFile:
    name: str
    content: bytes
    content_type: str


def status_label(status: SubmissionStatus) -> str:
    return translate(f"enums.submission_status.{status.value}")


def outcome_label(status: OutcomeStatus) -> str:
    return translate(f"enums.outcome_status.{status.value}")


def bucket_label(bucket: ReportBucket) -> str:
    return translate(f"reports.bucket.{bucket.value}")


class ExportRenderer:
    def __init__(self, config: ExportsConfig, reports: ReportService, other_track: str) -> None:
        self._config = config
        self._reports = reports
        self._other_track = other_track

    def application_values(self, workspace: CandidateWorkspace, application: ApplicationRecord) -> dict[str, str]:
        opportunity = application.opportunity
        return {
            "title": opportunity.title,
            "organization": opportunity.organization,
            "location": opportunity.location,
            "track": track_label(workspace, opportunity.id, self._other_track),
            "route": application.route,
            "appliedAt": application.applied_at or NO_VALUE,
            "submissionStatus": status_label(application.submission_status),
            "outcomeStatus": outcome_label(application.outcome_status),
            "matchScore": str(opportunity.match_score),
            "deadline": opportunity.deadline or NO_VALUE,
        }

    def applications(self, workspace: CandidateWorkspace, file_format: ExportFormat, stamp: str) -> RenderedFile:
        records = sorted(workspace.applications, key=lambda a: a.updated_at, reverse=True)
        table = [self.application_values(workspace, a) for a in records]
        return self._table(translate("reports.applicationsTitle"), table, file_format, f"{FILE_STEM}-applications-{stamp}")

    def report(self, user_id: str, request: ExportRequest, file_format: ExportFormat) -> RenderedFile:
        assert request.period is not None
        report = self._reports.build(user_id, request.period, request.date)
        name = f"{FILE_STEM}-{report.period.value}-report-{report.start_date}"
        if file_format is ExportFormat.CSV:
            return RenderedFile(f"{name}.csv", self._report_csv(report), CSV_TYPE)
        return RenderedFile(f"{name}.pdf", self._report_pdf(report), PDF_TYPE)

    def application(self, workspace: CandidateWorkspace, application_id: str) -> RenderedFile:
        record = next((a for a in workspace.applications if a.id == application_id), None)
        if record is None:
            raise ExportFailed(ExportFailure.APPLICATION_MISSING)
        title = translate("reports.recordTitle", {"title": record.opportunity.title})
        return RenderedFile(f"{FILE_STEM}-application-{record.id}.pdf", self._pdf(title, self._record_lines(workspace, record)), PDF_TYPE)

    def _table(self, title: str, table: list[dict[str, str]], file_format: ExportFormat, stem: str) -> RenderedFile:
        columns = self._config.application_columns
        if file_format is ExportFormat.CSV:
            header = [translate(c.label_key) for c in columns]
            return RenderedFile(f"{stem}.csv", render_csv(header, [[row[c.key] for c in columns] for row in table]), CSV_TYPE)
        lines = [self._row_line(row) for row in table] or [translate("reports.empty")]
        return RenderedFile(f"{stem}.pdf", self._pdf(title, lines), PDF_TYPE)

    def _row_line(self, row: dict[str, str]) -> str:
        return " | ".join(row[c.key] for c in self._config.application_columns if row[c.key])

    def _report_csv(self, report: ActivityReport) -> bytes:
        header = [
            translate("reports.column.title"),
            translate("reports.column.organization"),
            translate("reports.column.track"),
            translate("reports.column.route"),
            translate("reports.column.appliedAt"),
            translate("reports.column.submissionStatus"),
            translate("reports.column.outcomeStatus"),
            translate("reports.column.bucket"),
        ]
        rows = [
            [
                r.title,
                r.organization,
                r.track,
                r.route,
                r.applied_at or NO_VALUE,
                status_label(r.submission_status),
                outcome_label(r.outcome_status),
                bucket_label(r.bucket),
            ]
            for r in report.rows
        ]
        return render_csv(header, rows)

    def _report_pdf(self, report: ActivityReport) -> bytes:
        params = {"start": report.start_date, "end": report.end_date}
        lines = [translate("reports.range", params), translate("reports.timeZone", {"zone": report.time_zone}), BLANK_LINE]
        lines += [f"{bucket_label(b.bucket)}: {b.count}" for b in report.buckets]
        lines += [translate("reports.responses", {"count": report.responses}), BLANK_LINE]
        lines += [f"{r.title} - {r.organization} | {status_label(r.submission_status)} | {bucket_label(r.bucket)}" for r in report.rows]
        if report.by_track:
            lines += [BLANK_LINE, translate("reports.byTrack")] + [f"{INDENT}{x.label}: {x.count}" for x in report.by_track]
        if report.by_route:
            lines += [BLANK_LINE, translate("reports.byRoute")] + [f"{INDENT}{x.label}: {x.count}" for x in report.by_route]
        if report.upcoming:
            lines += [BLANK_LINE, translate("reports.upcoming")] + [
                f"{INDENT}{u.due_at} {u.organization}: {u.task_title}" for u in report.upcoming
            ]
        return self._pdf(translate(f"reports.title.{report.period.value}"), lines)

    def _record_lines(self, workspace: CandidateWorkspace, record: ApplicationRecord) -> list[str]:
        values = self.application_values(workspace, record)
        lines = [f"{translate(c.label_key)}: {values[c.key]}" for c in self._config.application_columns if values[c.key]]
        lines += [BLANK_LINE, translate("reports.timeline")]
        lines += [f"{INDENT}{e.at} {e.text}" for e in record.timeline]
        if record.questions:
            lines += [BLANK_LINE, translate("reports.questions")]
            lines += [f"{INDENT}{q.question} -> {q.answer}" for q in record.questions]
        if record.emails:
            lines += [BLANK_LINE, translate("reports.emails")]
            lines += [f"{INDENT}{m.sent_at} {m.to}: {m.subject}" for m in record.emails]
        if record.files:
            lines += [BLANK_LINE, translate("reports.files")]
            lines += [f"{INDENT}{f.name} (v{f.version}, {f.size_bytes})" for f in record.files]
        if record.evidence:
            lines += [BLANK_LINE, translate("reports.evidence")]
            lines += [f"{INDENT}{e.at} {e.text}" for e in record.evidence]
        lines += [BLANK_LINE, translate("reports.circular", {"url": record.circular.original_url}), record.circular.text]
        return lines

    def _pdf(self, title: str, lines: list[str]) -> bytes:
        return render_pdf(title, lines, self._config.pdf_lines_per_page, self._config.pdf_line_limit)


def kind_formats(config: ExportsConfig, kind: ExportKind) -> list[ExportFormat]:
    return next((rule.formats for rule in config.rules if rule.kind is kind), list[ExportFormat]())
