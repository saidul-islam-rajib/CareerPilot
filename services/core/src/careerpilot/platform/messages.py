import json
import re
from collections.abc import Mapping
from functools import cache
from pathlib import Path
from typing import Any, cast

CATALOG_FILE = Path("packages") / "i18n" / "src" / "locales" / "en.json"
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def default_catalog_path() -> Path:
    return Path(__file__).resolve().parents[5] / CATALOG_FILE


@cache
def load_catalog(path: Path | None = None) -> dict[str, Any]:
    return cast("dict[str, Any]", json.loads((path or default_catalog_path()).read_text(encoding="utf-8")))


def translate(key: str, params: Mapping[str, str | int] | None = None) -> str:
    node: Any = load_catalog()
    for part in key.split("."):
        if not isinstance(node, dict):
            return key
        node = cast("dict[str, Any]", node).get(part)
    if not isinstance(node, str):
        return key
    values = params or {}
    return PLACEHOLDER.sub(lambda m: str(values.get(m.group(1), m.group(0))), node)
