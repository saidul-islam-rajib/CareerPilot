import hashlib
import html
import re
import unicodedata
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urlunsplit

from careerpilot.platform.clock import iso, parse_iso

TAG = re.compile(r"<[^>]+>")
SPACE = re.compile(r"\s+")
NON_WORD = re.compile(r"[^\w]+")
DIGEST_LENGTH = 32
FIELD_SEPARATOR = "|"


def plain_text(markup: str) -> str:
    return SPACE.sub(" ", TAG.sub(" ", html.unescape(html.unescape(markup)))).strip()


def normalized(value: str) -> str:
    folded = unicodedata.normalize("NFKC", value).casefold()
    return NON_WORD.sub(" ", folded).strip()


def digest(*parts: str) -> str:
    return hashlib.sha256(FIELD_SEPARATOR.join(parts).encode()).hexdigest()[:DIGEST_LENGTH]


def listing_fingerprint(organization: str, title: str, location: str) -> str:
    return digest(normalized(organization), normalized(title), normalized(location))


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), "", ""))


def rfc822_to_iso(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return iso(parsedate_to_datetime(value))
    except (TypeError, ValueError):
        return None


def iso_or_none(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return iso(parse_iso(value))
    except ValueError:
        return None
