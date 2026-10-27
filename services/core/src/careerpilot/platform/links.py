import re
from collections.abc import Callable
from urllib.parse import urlencode

from careerpilot.platform.errors import DomainError, validation_error
from careerpilot.platform.one_time_codes import CodeCheck

TOKEN_SEPARATOR = "."
TOKEN_FORMAT = re.compile(r"[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{16,256}")
TOKEN_PARAMETER = "token"
URL_SEPARATOR = "/"
LINK_INVALID = "link_invalid"
LINK_EXPIRED = "link_expired"
LINK_ERRORS: dict[CodeCheck, Callable[[], DomainError]] = {
    CodeCheck.INVALID: lambda: validation_error(LINK_INVALID),
    CodeCheck.EXPIRED: lambda: validation_error(LINK_EXPIRED),
    CodeCheck.LOCKED: lambda: validation_error(LINK_EXPIRED),
}


def join_token(owner_id: str, secret: str) -> str:
    return TOKEN_SEPARATOR.join((owner_id, secret))


def split_token(token: str) -> tuple[str, str]:
    cleaned = token.strip()
    if TOKEN_FORMAT.fullmatch(cleaned) is None:
        raise validation_error(LINK_INVALID)
    owner_id, _, secret = cleaned.partition(TOKEN_SEPARATOR)
    return owner_id, secret


def web_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip(URL_SEPARATOR)}{path}"


def link_url(base_url: str, path: str, token: str) -> str:
    return f"{web_url(base_url, path)}?{urlencode({TOKEN_PARAMETER: token})}"
