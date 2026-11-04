import csv
import io

from careerpilot.candidate.models import StoredFile
from careerpilot.messaging.adapters.in_memory import InMemoryMessageRepository
from careerpilot.messaging.models import Attachment, Message
from careerpilot.platform.enums import MemberType, MessageKind
from careerpilot.privacy.documents import guard_formula, render_csv, render_pdf

BOM = "﻿"


def test_csv_neutralises_formula_cells_and_keeps_unicode() -> None:
    data = render_csv(["a", "b"], [["=SUM(1)", "রাজিব"], ["+1", "plain"]]).decode("utf-8").removeprefix(BOM)
    rows = list(csv.reader(io.StringIO(data)))
    assert rows[1] == ["'=SUM(1)", "রাজিব"]
    assert rows[2][0] == "'+1"
    assert guard_formula("safe") == "safe"


def test_pdf_has_one_page_per_block_of_lines_and_escapes_text() -> None:
    lines = [f"line (number) {number}" for number in range(25)]
    data = render_pdf("Title", lines, lines_per_page=10, line_width=80)
    assert data.startswith(b"%PDF-1.4")
    assert data.count(b"/Type /Page ") == 3
    assert b"\\(number\\)" in data


def test_pdf_replaces_characters_outside_latin_1() -> None:
    data = render_pdf("Report", ["রাজিব"], lines_per_page=10, line_width=80)
    assert b"(?????)" in data


def test_erasing_a_sender_blanks_text_and_returns_attachment_keys() -> None:
    repository = InMemoryMessageRepository()
    file = StoredFile(key="messages/a.png", file_name="a.png", content_type="image/png", size_bytes=3, uploaded_at="2026-10-20T00:00:00Z")
    repository.add(
        Message(
            id="m1",
            conversation_id="c1",
            sender_id="usr_a",
            sender_type=MemberType.USER,
            sender_name="Ayesha",
            kind=MessageKind.TEXT,
            text="hello",
            attachment=Attachment(file=file),
            created_at="2026-10-20T00:00:00Z",
        )
    )
    repository.add(
        Message(
            id="m2",
            conversation_id="c1",
            sender_id="usr_b",
            sender_type=MemberType.USER,
            kind=MessageKind.TEXT,
            text="keep",
            created_at="2026-10-20T00:01:00Z",
        )
    )
    assert repository.erase_sender("usr_a", "Deleted user") == ["messages/a.png"]
    erased = repository.get("m1")
    assert erased is not None
    assert (erased.text, erased.attachment, erased.sender_name) == ("Deleted user", None, "Deleted user")
    kept = repository.get("m2")
    assert kept is not None
    assert kept.text == "keep"
