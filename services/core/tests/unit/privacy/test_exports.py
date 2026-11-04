import csv
import io
import json
import zipfile
from datetime import timedelta

import pytest

from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.privacy.enums import ExportFormat, ExportKind, ExportStatus, ReportPeriod
from careerpilot.privacy.exports import ExportSpec
from tests.unit.conftest import DEMO_USER
from tests.unit.integrations.conftest import connect
from tests.unit.privacy.conftest import BASE_URL, OWNER_PASSWORD, QueuedRunner, RepositoryTap, request_view, stored_bytes

CSV_SPEC = ExportSpec(ExportKind.APPLICATIONS, ExportFormat.CSV)
BOM = "﻿"


def test_applications_csv_has_translated_header_and_a_row_per_application(
    container: Container, storage: InMemoryFileStorage, tap: RepositoryTap
) -> None:
    view = request_view(container, container.privacy.exports.request(DEMO_USER, CSV_SPEC))
    assert view.status is ExportStatus.READY
    assert view.file_name is not None
    assert view.file_name.endswith(".csv")
    text = stored_bytes(storage, view).decode("utf-8").removeprefix(BOM)
    rows = list(csv.reader(io.StringIO(text)))
    assert rows[0][:3] == ["Title", "Organization", "Location"]
    assert len(rows) == 1 + len(tap.repos.workspaces.get(DEMO_USER).applications)


def test_applications_pdf_is_a_valid_pdf_with_every_application(container: Container, storage: InMemoryFileStorage) -> None:
    spec = ExportSpec(ExportKind.APPLICATIONS, ExportFormat.PDF)
    data = stored_bytes(storage, request_view(container, container.privacy.exports.request(DEMO_USER, spec)))
    assert data.startswith(b"%PDF-")
    assert data.rstrip().endswith(b"%%EOF")
    assert data.count(b"Tj") >= 4


def test_report_export_in_both_formats(container: Container, storage: InMemoryFileStorage) -> None:
    for file_format, marker in ((ExportFormat.CSV, b"Group"), (ExportFormat.PDF, b"%PDF-")):
        spec = ExportSpec(ExportKind.REPORT, file_format, period=ReportPeriod.WEEKLY, date="2026-10-14")
        view = request_view(container, container.privacy.exports.request(DEMO_USER, spec))
        assert marker in stored_bytes(storage, view)


def test_single_application_record_is_exported_as_pdf(container: Container, storage: InMemoryFileStorage) -> None:
    spec = ExportSpec(ExportKind.APPLICATION, ExportFormat.PDF, application_id="app_bay")
    view = request_view(container, container.privacy.exports.request(DEMO_USER, spec))
    assert stored_bytes(storage, view).startswith(b"%PDF-")
    with pytest.raises(DomainError) as missing:
        container.privacy.exports.request(DEMO_USER, ExportSpec(ExportKind.APPLICATION, ExportFormat.PDF, application_id="app_other"))
    assert missing.value.code is ErrorCode.NOT_FOUND


def test_unsupported_format_for_a_kind_is_rejected(container: Container) -> None:
    with pytest.raises(DomainError) as error:
        container.privacy.exports.request(DEMO_USER, ExportSpec(ExportKind.APPLICATIONS, ExportFormat.ZIP))
    assert error.value.code is ErrorCode.VALIDATION


def test_full_archive_needs_the_password(container: Container) -> None:
    spec = ExportSpec(ExportKind.ARCHIVE, ExportFormat.ZIP, password="wrong")
    with pytest.raises(DomainError) as error:
        container.privacy.exports.request(DEMO_USER, spec)
    assert error.value.code is ErrorCode.INVALID_CREDENTIALS
    with pytest.raises(DomainError):
        container.privacy.exports.request(DEMO_USER, ExportSpec(ExportKind.ARCHIVE, ExportFormat.ZIP))


def test_full_archive_holds_the_sections_and_no_secrets(container: Container, storage: InMemoryFileStorage) -> None:
    connect(container)
    spec = ExportSpec(ExportKind.ARCHIVE, ExportFormat.ZIP, password=OWNER_PASSWORD)
    view = request_view(container, container.privacy.exports.request(DEMO_USER, spec))
    archive = zipfile.ZipFile(io.BytesIO(stored_bytes(storage, view)))
    names = set(archive.namelist())
    assert {"profile.json", "applications.json", "consents.json", "connections.json", "manifest.json"} <= names
    everything = "".join(archive.read(name).decode("utf-8", "ignore") for name in names if name.endswith(".json")).lower()
    for secret in ("passwordhash", "password_hash", "sealedtokens", "refresh_token", "access_token", "hashed:"):
        assert secret.lower() not in everything
    connections = json.loads(archive.read("connections.json"))
    assert connections[0]["email"] == "ayesha@gmail.com"
    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["userId"] == DEMO_USER


def test_downloads_are_signed_links_with_a_limited_life(container: Container, clock: FixedClock) -> None:
    view = request_view(container, container.privacy.exports.request(DEMO_USER, CSV_SPEC))
    assert view.download_url is not None
    assert "signature=" in view.download_url
    assert view.expires_at is not None
    clock.advance(timedelta(hours=25))
    assert container.privacy.exports.get(DEMO_USER, view.id, BASE_URL).download_url is None


def test_expired_exports_are_erased_and_marked(container: Container, clock: FixedClock, storage: InMemoryFileStorage) -> None:
    view = request_view(container, container.privacy.exports.request(DEMO_USER, CSV_SPEC))
    key_data = stored_bytes(storage, view)
    assert key_data
    clock.advance(timedelta(hours=25))
    assert container.privacy.exports.process_pending() == 1
    expired = container.privacy.exports.get(DEMO_USER, view.id, BASE_URL)
    assert expired.status is ExportStatus.EXPIRED
    assert expired.download_url is None
    assert container.privacy.exports.process_pending() == 0


def test_requests_wait_for_the_background_job_and_count_toward_limits(queued: Container, queue: QueuedRunner) -> None:
    view = queued.privacy.exports.request(DEMO_USER, CSV_SPEC)
    assert view.status is ExportStatus.QUEUED
    assert view.download_url is None
    assert queued.privacy.exports.process_pending() == 1
    assert queued.privacy.exports.get(DEMO_USER, view.id, BASE_URL).status is ExportStatus.READY
    assert len(queue.jobs) == 1
    for _ in range(4):
        queued.privacy.exports.request(DEMO_USER, CSV_SPEC)
    with pytest.raises(DomainError) as error:
        queued.privacy.exports.request(DEMO_USER, CSV_SPEC)
    assert error.value.code is ErrorCode.VALIDATION


def test_exports_belong_to_their_owner(container: Container) -> None:
    view = container.privacy.exports.request(DEMO_USER, CSV_SPEC)
    with pytest.raises(DomainError) as error:
        container.privacy.exports.get("usr_other", view.id, BASE_URL)
    assert error.value.code is ErrorCode.NOT_FOUND
    assert container.privacy.exports.history("usr_other", BASE_URL) == []
