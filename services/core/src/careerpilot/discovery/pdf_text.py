import io

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from careerpilot.discovery.text import plain_text
from careerpilot.platform.config import BangladeshConfig


class PdfReadError(Exception):
    pass


def pdf_text(content: bytes, config: BangladeshConfig) -> str:
    if len(content) > config.max_pdf_bytes:
        raise PdfReadError("too_large")
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = reader.pages[: config.max_pdf_pages]
        return plain_text(" ".join(page.extract_text() or "" for page in pages))
    except (PyPdfError, ValueError, OSError) as error:
        raise PdfReadError("unreadable") from error
