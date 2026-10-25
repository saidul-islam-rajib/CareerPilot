import json
import logging

from careerpilot.platform.config import load_settings
from careerpilot.platform.telemetry import JsonFormatter, ScrubFilter, configure_telemetry, scrub

CONFIG = load_settings("local").observability


def record(msg: object, args: object = None) -> logging.LogRecord:
    return logging.LogRecord("t", logging.INFO, __file__, 1, msg, args, None)  # type: ignore[arg-type]


def test_scrub_removes_secrets_and_emails() -> None:
    keys = frozenset(CONFIG.scrub_keys)
    cleaned = scrub({"password": "x", "nested": {"accessToken": "y"}, "note": "mail a.b@example.com now"}, keys, CONFIG.redacted)
    assert cleaned == {"password": "[redacted]", "nested": {"accessToken": "[redacted]"}, "note": "mail [redacted] now"}


def test_scrub_filter_cleans_messages_and_args() -> None:
    entry = record("user %s signed in with %s", ("x@example.com", {"password": "p"}))
    assert ScrubFilter(CONFIG).filter(entry)
    assert entry.getMessage() == "user [redacted] signed in with {'password': '[redacted]'}"


def test_json_formatter_outputs_structured_lines() -> None:
    payload = json.loads(JsonFormatter().format(record("hello")))
    assert payload["message"] == "hello"
    assert payload["level"] == "INFO"
    assert "trace_id" not in payload


def test_telemetry_stays_off_without_endpoint() -> None:
    assert configure_telemetry(CONFIG, "test") is False
