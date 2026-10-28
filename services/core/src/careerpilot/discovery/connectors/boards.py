import json
from datetime import UTC, datetime
from typing import Any, cast

from careerpilot.discovery.ports import FetchError
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import WorkArrangement

INVALID_BOARD = "invalid_board"
MILLISECONDS = 1000
COUNTRY_CODE_LENGTH = 2
ARRANGEMENT_WORDS = {
    "remote": WorkArrangement.REMOTE,
    "telecommute": WorkArrangement.REMOTE,
    "hybrid": WorkArrangement.HYBRID,
    "onsite": WorkArrangement.ONSITE,
    "on-site": WorkArrangement.ONSITE,
    "on_site": WorkArrangement.ONSITE,
    "in_office": WorkArrangement.ONSITE,
    "office": WorkArrangement.ONSITE,
}


def json_document(body: str) -> Any:
    try:
        return json.loads(body)
    except json.JSONDecodeError as error:
        raise FetchError(INVALID_BOARD) from error


def mapping(value: Any) -> dict[str, Any]:
    return cast("dict[str, Any]", value) if isinstance(value, dict) else {}


def items(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [mapping(item) for item in cast("list[Any]", value) if isinstance(item, dict)]


def text(value: Any) -> str:
    return str(value or "").strip()


def arrangement(value: Any, fallback: str) -> str:
    found = ARRANGEMENT_WORDS.get(text(value).lower().replace(" ", ""))
    return found.value if found else fallback


def country_code(value: str, fallback: str) -> str:
    return value.upper() if len(value) == COUNTRY_CODE_LENGTH else fallback


def epoch_ms_iso(value: Any) -> str | None:
    if not isinstance(value, int | float) or isinstance(value, bool):
        return None
    return iso(datetime.fromtimestamp(value / MILLISECONDS, UTC))


def joined(*parts: str) -> str:
    return ", ".join(part for part in parts if part)
