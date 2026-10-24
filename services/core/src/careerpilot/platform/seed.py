import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, cast

from careerpilot.platform.clock import iso, parse_iso

ISO_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
SEED_FILE = Path("seeds") / "demo" / "demo-seed.json"


def default_seed_path() -> Path:
    return Path(__file__).resolve().parents[5] / SEED_FILE


def shift_timestamps(value: Any, offset_seconds: float) -> Any:
    if isinstance(value, dict):
        return {key: shift_timestamps(item, offset_seconds) for key, item in cast("dict[str, Any]", value).items()}
    if isinstance(value, list):
        return [shift_timestamps(item, offset_seconds) for item in cast("list[Any]", value)]
    if isinstance(value, str) and ISO_TIMESTAMP.match(value):
        return iso(datetime.fromtimestamp(parse_iso(value).timestamp() + offset_seconds, parse_iso(value).tzinfo))
    return value


def load_demo_seed(now: datetime, path: Path | None = None) -> dict[str, Any]:
    raw: dict[str, Any] = json.loads((path or default_seed_path()).read_text(encoding="utf-8"))
    offset = now.timestamp() - parse_iso(str(raw["referenceNow"])).timestamp()
    shifted: dict[str, Any] = shift_timestamps(raw, offset)
    return shifted
