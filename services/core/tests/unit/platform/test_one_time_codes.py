from datetime import timedelta

import pytest

from careerpilot.platform.clock import FixedClock
from careerpilot.platform.config import VerificationConfig, load_settings
from careerpilot.platform.coordination import KeySpace
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.keyvalue import InMemoryKeyValueStore, StoreUnavailableError
from careerpilot.platform.one_time_codes import CodeCheck, OneTimeCodes, random_code

CODE = "123456"
TARGET = "usr_demo:c_email:abc"


class RecordingStore(InMemoryKeyValueStore):
    def __init__(self, clock: FixedClock) -> None:
        super().__init__(clock)
        self.values: list[str] = []

    def put(self, key: str, value: str, ttl_seconds: int) -> None:
        self.values.append(value)
        super().put(key, value, ttl_seconds)


class BrokenStore(InMemoryKeyValueStore):
    def get(self, key: str) -> str | None:
        raise StoreUnavailableError(key)


@pytest.fixture
def config() -> VerificationConfig:
    return load_settings("local").verification


def codes(store: InMemoryKeyValueStore, config: VerificationConfig) -> OneTimeCodes:
    return OneTimeCodes(store, KeySpace(load_settings("local").coordination), config, "test-secret", generate=lambda _: CODE)


def refusal(action: object) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as caught:
        assert callable(action)
        action()
    return caught.value.code, caught.value.detail


def test_codes_are_stored_hashed_and_work_once(clock: FixedClock, config: VerificationConfig) -> None:
    store = RecordingStore(clock)
    otp = codes(store, config)
    assert otp.issue("contact", TARGET) == CODE
    assert all(CODE not in value for value in store.values)
    assert otp.check("contact", TARGET, " 123456 ") is CodeCheck.VALID
    assert otp.check("contact", TARGET, CODE) is CodeCheck.EXPIRED


def test_wrong_codes_lock_and_old_codes_expire(clock: FixedClock, config: VerificationConfig) -> None:
    otp = codes(InMemoryKeyValueStore(clock), config)
    otp.issue("contact", TARGET)
    results = [otp.check("contact", TARGET, "000000") for _ in range(config.max_attempts)]
    assert results[:-1] == [CodeCheck.INVALID] * (config.max_attempts - 1)
    assert results[-1] is CodeCheck.LOCKED
    assert otp.check("contact", TARGET, CODE) is CodeCheck.EXPIRED
    clock.advance(timedelta(seconds=config.resend_cooldown_seconds))
    otp.issue("contact", TARGET)
    clock.advance(timedelta(seconds=config.code_ttl_seconds + 1))
    assert otp.check("contact", TARGET, CODE) is CodeCheck.EXPIRED


def test_resend_cooldown_and_hourly_limit(clock: FixedClock, config: VerificationConfig) -> None:
    otp = codes(InMemoryKeyValueStore(clock), config)
    otp.issue("contact", TARGET)
    assert otp.resend_after("contact", TARGET) == config.resend_cooldown_seconds
    assert refusal(lambda: otp.issue("contact", TARGET)) == (ErrorCode.TOO_MANY_ATTEMPTS, "resend_cooldown")
    for _ in range(config.sends_per_hour - 1):
        clock.advance(timedelta(seconds=config.resend_cooldown_seconds))
        otp.issue("contact", TARGET)
    clock.advance(timedelta(seconds=config.resend_cooldown_seconds))
    assert refusal(lambda: otp.issue("contact", TARGET)) == (ErrorCode.TOO_MANY_ATTEMPTS, "send_limit")


def test_unavailable_store_fails_closed(clock: FixedClock, config: VerificationConfig) -> None:
    otp = codes(BrokenStore(clock), config)
    assert refusal(lambda: otp.issue("contact", TARGET))[0] is ErrorCode.SERVICE_UNAVAILABLE
    assert refusal(lambda: otp.check("contact", TARGET, CODE))[0] is ErrorCode.SERVICE_UNAVAILABLE


def test_random_codes_have_the_configured_length() -> None:
    assert all(len(random_code(6)) == 6 and random_code(6).isdigit() for _ in range(20))
