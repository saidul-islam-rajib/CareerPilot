import csv
import io
import textwrap
from collections.abc import Sequence

PDF_ENCODING = "latin-1"
PAGE_WIDTH = 612
PAGE_HEIGHT = 792
MARGIN = 54
FONT_SIZE = 10
LEADING = 13
TITLE_SIZE = 14
CSV_BOM = "\ufeff"


def render_csv(header: Sequence[str], rows: Sequence[Sequence[str]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow([guard_formula(cell) for cell in header])
    for row in rows:
        writer.writerow([guard_formula(cell) for cell in row])
    return (CSV_BOM + buffer.getvalue()).encode("utf-8")


FORMULA_STARTS = ("=", "+", "-", "@")
FORMULA_GUARD = "'"


def guard_formula(cell: str) -> str:
    return FORMULA_GUARD + cell if cell.startswith(FORMULA_STARTS) else cell


def wrap_lines(lines: Sequence[str], width: int) -> list[str]:
    wrapped: list[str] = []
    for line in lines:
        wrapped.extend(textwrap.wrap(line, width=width) or [""])
    return wrapped


def _escape(text: str) -> bytes:
    return text.encode(PDF_ENCODING, "replace").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def _page_stream(title: str | None, lines: Sequence[str]) -> bytes:
    top = PAGE_HEIGHT - MARGIN
    parts: list[bytes] = [f"BT /F1 {FONT_SIZE} Tf {LEADING} TL {MARGIN} {top} Td".encode()]
    if title is not None:
        parts.append(f"/F1 {TITLE_SIZE} Tf".encode() + b" (" + _escape(title) + b") Tj T* " + f"/F1 {FONT_SIZE} Tf T*".encode())
    for line in lines:
        parts.append(b"(" + _escape(line) + b") Tj T*")
    parts.append(b"ET")
    return b"\n".join(parts)


def render_pdf(title: str, lines: Sequence[str], lines_per_page: int, line_width: int) -> bytes:
    body = wrap_lines(lines, line_width)
    pages = [body[i : i + lines_per_page] for i in range(0, len(body), lines_per_page)] or [[]]
    objects: list[bytes] = [b"", b""]
    font_number = 3 + len(pages) * 2
    kids: list[str] = []
    for index, page in enumerate(pages):
        page_number = 3 + index * 2
        kids.append(f"{page_number} 0 R")
        stream = _page_stream(title if index == 0 else None, page)
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] /Contents {page_number + 1} 0 R "
            f"/Resources << /Font << /F1 {font_number} 0 R >> >> >>".encode()
        )
        objects.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>".encode()
    document = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, content in enumerate(objects, start=1):
        offsets.append(len(document))
        document += f"{number} 0 obj\n".encode() + content + b"\nendobj\n"
    xref = len(document)
    document += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    document += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    document += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(document)
