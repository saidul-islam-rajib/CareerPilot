import shutil
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from careerpilot.platform.clock import FixedClock, SequentialIdGenerator, iso, parse_iso
from careerpilot.platform.config import deep_merge, load_settings
from careerpilot.platform.enums import ThemeKey
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.security import Argon2PasswordHasher, TokenService
from careerpilot.platform.seed import load_demo_seed, shift_timestamps

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)


def test_settings_load_from_repository_yaml() -> None:
    settings = load_settings("local")
    assert settings.ui.active_theme is ThemeKey.SOBER
    assert str(settings.branding.developer_url) == "https://team-sober.com/"
    assert settings.security.token_algorithm == "HS256"


def test_deep_merge_overrides_nested_values() -> None:
    assert deep_merge({"a": {"b": 1, "c": 2}}, {"a": {"b": 3}}) == {"a": {"b": 3, "c": 2}}


def test_password_hashing_round_trip() -> None:
    hasher = Argon2PasswordHasher()
    hashed = hasher.hash("admin@sober.com")
    assert hashed != "admin@sober.com"
    assert hasher.verify(hashed, "admin@sober.com")
    assert not hasher.verify(hashed, "wrong")
    assert not hasher.verify("not-a-hash", "x")


def test_tokens_verify_audience_and_expiry() -> None:
    clock = FixedClock(NOW)
    service = TokenService(load_settings("local").security, clock, "test-secret-with-enough-length-for-hmac")
    token = service.issue("usr_1", "user", 10)
    assert service.verify(token, "user").subject == "usr_1"
    with pytest.raises(DomainError) as wrong_audience:
        service.verify(token, "admin")
    assert wrong_audience.value.code is ErrorCode.UNAUTHORIZED
    clock.advance(timedelta(minutes=11))
    with pytest.raises(DomainError):
        service.verify(token, "user")


def test_seed_timestamps_shift_to_now() -> None:
    shifted = shift_timestamps({"at": "2026-10-20T06:00:00.000Z", "name": "x"}, 3600)
    assert shifted == {"at": "2026-10-20T07:00:00.000Z", "name": "x"}
    later = NOW + timedelta(days=4)
    seed = load_demo_seed(later)
    assert seed["referenceNow"] == iso(later)
    assert len(seed["user"]["opportunities"]) == 8


def test_clock_helpers() -> None:
    assert parse_iso(iso(NOW)) == NOW
    ids = SequentialIdGenerator()
    assert [ids.next("a"), ids.next("b")] == ["a_1", "b_2"]


REPOSITORY_CONFIG = Path(__file__).resolve().parents[5] / "config"


def test_secrets_typed_into_config_files_stop_the_api_from_starting() -> None:
    with tempfile.TemporaryDirectory() as folder:
        assert_rejects_secrets_in(Path(folder) / "config")


def assert_rejects_secrets_in(root: Path) -> None:
    shutil.copytree(REPOSITORY_CONFIG, root)
    mail = root / "defaults" / "mail.yaml"
    text = mail.read_text(encoding="utf-8")
    text = text.replace("smtp_user_env: CAREERPILOT_MAIL_USER", "smtp_user_env: someone@gmail.com")
    text = text.replace("smtp_password_env: CAREERPILOT_MAIL_PASSWORD", "smtp_password_env: abcd efgh ijkl mnop")
    mail.write_text(text, encoding="utf-8")
    with pytest.raises(ValidationError) as error:
        load_settings("local", root)
    assert {tuple(e["loc"][-1:]) for e in error.value.errors()} == {("smtp_user_env",), ("smtp_password_env",)}
    assert "abcd" not in str([e.get("input") for e in error.value.errors() if e["loc"][-1] == "smtp_user_env"])


LOCAL_SEED_DOMAIN = "sober.com"
RESERVED_EXAMPLE_DOMAINS = {"example.com", "example.org", "example.net"}


@pytest.mark.parametrize("app_env", ["local", "docker", "http"])
def test_only_seed_and_example_domains_stay_in_the_mail_sandbox(app_env: str) -> None:
    domains = set(load_settings(app_env).mail.sandbox_only_domains)
    assert domains <= RESERVED_EXAMPLE_DOMAINS | {LOCAL_SEED_DOMAIN}


def test_every_secret_comes_from_a_named_environment_setting() -> None:
    settings = load_settings("local")
    names = [
        settings.mail.smtp_user_env,
        settings.mail.smtp_password_env,
        settings.persistence.database_url_env,
        settings.matching.api_key_env,
    ]
    assert all(name.isupper() and " " not in name for name in names)
