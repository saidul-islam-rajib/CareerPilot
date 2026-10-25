from collections.abc import Callable
from datetime import timedelta
from typing import Any

import fakeredis
import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import CoordinationConfig, load_settings
from careerpilot.platform.coordination import (
    GuardScope,
    KeyNamespace,
    KeySpace,
    MetadataCache,
    SignInGuard,
    fingerprint,
    release_fingerprint,
)
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.keyvalue import InMemoryKeyValueStore, KeyValueStore, RedisKeyValueStore, StoreUnavailableError
from tests.unit.conftest import CLIENT, TEST_SECRET, FakeHasher

EMAIL = "admin@sober.com"


@pytest.fixture
def config() -> CoordinationConfig:
    return load_settings("local").coordination


def fake_redis_store(server: fakeredis.FakeServer | None = None) -> RedisKeyValueStore:
    return RedisKeyValueStore(fakeredis.FakeRedis(server=server or fakeredis.FakeServer(), decode_responses=True))


def unavailable_store() -> RedisKeyValueStore:
    server = fakeredis.FakeServer()
    server.connected = False
    return fake_redis_store(server)


@pytest.fixture(params=["memory", "redis"])
def store(request: pytest.FixtureRequest, clock: FixedClock) -> KeyValueStore:
    return InMemoryKeyValueStore(clock) if request.param == "memory" else fake_redis_store()


def test_store_contract(store: KeyValueStore) -> None:
    assert store.get("k") is None
    store.put("k", "v", 60)
    assert store.get("k") == "v"
    assert 0 < store.seconds_left("k") <= 60
    store.remove("k")
    assert store.get("k") is None
    assert [store.increment("n", 60) for _ in range(3)] == [1, 2, 3]
    assert 0 < store.seconds_left("n") <= 60


def test_in_memory_entries_expire_and_windows_are_fixed(clock: FixedClock) -> None:
    store = InMemoryKeyValueStore(clock)
    store.increment("n", 60)
    clock.advance(timedelta(seconds=30))
    store.increment("n", 60)
    assert store.seconds_left("n") == 30
    clock.advance(timedelta(seconds=30))
    assert store.get("n") is None
    assert store.increment("n", 60) == 1


def test_redis_errors_become_store_unavailable() -> None:
    with pytest.raises(StoreUnavailableError):
        unavailable_store().get("k")


def test_keys_are_namespaced_and_hold_no_personal_data(config: CoordinationConfig) -> None:
    key = KeySpace(config).key(KeyNamespace.SIGN_IN_FAILURES, GuardScope.USER.value, fingerprint(EMAIL))
    assert key.startswith(f"{config.key_prefix}:{config.environment}:auth:fail:user:")
    assert EMAIL not in key
    assert fingerprint(" ADMIN@sober.com ") == fingerprint(EMAIL)


def test_guard_locks_after_repeated_failures_and_unlocks_after_window(config: CoordinationConfig, clock: FixedClock) -> None:
    guard = SignInGuard(InMemoryKeyValueStore(clock), KeySpace(config), config)
    for _ in range(config.sign_in_failures.limit):
        guard.ensure_allowed(GuardScope.USER, EMAIL, CLIENT.ip)
        guard.record_failure(GuardScope.USER, EMAIL)
    with pytest.raises(DomainError) as locked:
        guard.ensure_allowed(GuardScope.USER, EMAIL, CLIENT.ip)
    assert locked.value.code is ErrorCode.TOO_MANY_ATTEMPTS
    guard.ensure_allowed(GuardScope.ADMIN, EMAIL, CLIENT.ip)
    clock.advance(timedelta(seconds=config.sign_in_failures.window_seconds))
    guard.ensure_allowed(GuardScope.USER, EMAIL, CLIENT.ip)


def test_guard_success_clears_failures(config: CoordinationConfig, clock: FixedClock) -> None:
    guard = SignInGuard(InMemoryKeyValueStore(clock), KeySpace(config), config)
    for _ in range(config.sign_in_failures.limit - 1):
        guard.record_failure(GuardScope.USER, EMAIL)
    guard.clear(GuardScope.USER, EMAIL)
    guard.record_failure(GuardScope.USER, EMAIL)
    guard.ensure_allowed(GuardScope.USER, EMAIL, CLIENT.ip)


def test_guard_throttles_requests_per_client(config: CoordinationConfig, clock: FixedClock) -> None:
    guard = SignInGuard(InMemoryKeyValueStore(clock), KeySpace(config), config)
    for _ in range(config.auth_requests.limit):
        guard.throttle(GuardScope.USER, CLIENT.ip)
    with pytest.raises(DomainError) as throttled:
        guard.throttle(GuardScope.USER, CLIENT.ip)
    assert throttled.value.code is ErrorCode.TOO_MANY_ATTEMPTS
    guard.throttle(GuardScope.USER, "10.0.0.2")


def test_guard_fails_closed_when_store_is_unavailable(config: CoordinationConfig) -> None:
    guard = SignInGuard(unavailable_store(), KeySpace(config), config)
    with pytest.raises(DomainError) as unavailable:
        guard.ensure_allowed(GuardScope.USER, EMAIL, CLIENT.ip)
    assert unavailable.value.code is ErrorCode.SERVICE_UNAVAILABLE
    assert unavailable.value.http_status == 503


def counting_loader(value: dict[str, Any]) -> tuple[Callable[[], dict[str, Any]], list[int]]:
    calls: list[int] = []

    def load() -> dict[str, Any]:
        calls.append(1)
        return value

    return load, calls


def test_metadata_cache_is_cache_aside_and_invalidates(store: KeyValueStore, config: CoordinationConfig) -> None:
    cache = MetadataCache(store, KeySpace(config), config)
    load, calls = counting_loader({"theme": "sober"})
    assert cache.get_or_load("public-config", load) == {"theme": "sober"}
    assert cache.get_or_load("public-config", load) == {"theme": "sober"}
    assert len(calls) == 1
    cache.invalidate("public-config")
    cache.get_or_load("public-config", load)
    assert len(calls) == 2


def test_metadata_cache_ttl_has_bounded_jitter(config: CoordinationConfig, clock: FixedClock) -> None:
    store = InMemoryKeyValueStore(clock)
    spread = config.metadata_ttl_seconds * config.ttl_jitter_ratio
    MetadataCache(store, KeySpace(config), config, jitter=lambda _low, high: high).get_or_load("a", dict)
    key = KeySpace(config).key(KeyNamespace.META, "a", "v1")
    assert store.seconds_left(key) == round(config.metadata_ttl_seconds + spread)


def test_metadata_cache_fails_open_when_store_is_unavailable(config: CoordinationConfig) -> None:
    cache = MetadataCache(unavailable_store(), KeySpace(config), config)
    load, calls = counting_loader({"theme": "sober"})
    assert cache.get_or_load("public-config", load) == {"theme": "sober"}
    cache.invalidate("public-config")
    assert len(calls) == 1


@pytest.fixture
def redis_container(clock: FixedClock) -> Container:
    overrides = ContainerOverrides(
        file_storage=InMemoryFileStorage(),
        settings=load_settings("local"),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        cache_store=fake_redis_store(),
        coord_store=fake_redis_store(),
    )
    return build_container(overrides)


def test_sign_in_is_locked_after_repeated_wrong_passwords(redis_container: Container, config: CoordinationConfig) -> None:
    for _ in range(config.sign_in_failures.limit):
        with pytest.raises(DomainError):
            redis_container.auth.sign_in(EMAIL, "wrong", CLIENT)
    with pytest.raises(DomainError) as locked:
        redis_container.auth.sign_in(EMAIL, "admin@sober.com", CLIENT)
    assert locked.value.code is ErrorCode.TOO_MANY_ATTEMPTS
    assert redis_container.admin_auth.sign_in(EMAIL, "admin@sober.com", CLIENT.ip).access_token


def test_admin_theme_change_refreshes_cached_public_config(redis_container: Container) -> None:
    assert redis_container.public_config.get()["theme"] == "sober"
    admin = redis_container.admin_auth.authenticate(redis_container.admin_auth.sign_in(EMAIL, "admin@sober.com", CLIENT.ip).access_token)
    redis_container.admin_settings.update(admin, {"active_theme": "orchid"})
    assert redis_container.public_config.get()["theme"] == "orchid"


def test_metadata_cache_releases_do_not_share_entries(config: CoordinationConfig, clock: FixedClock) -> None:
    store = InMemoryKeyValueStore(clock)
    old_load, old_calls = counting_loader({"shape": "old"})
    new_load, new_calls = counting_loader({"shape": "new"})
    MetadataCache(store, KeySpace(config), config, release=release_fingerprint("settings-a", "1.0.0")).get_or_load(
        "public-config", old_load
    )
    fresh = MetadataCache(store, KeySpace(config), config, release=release_fingerprint("settings-b", "1.0.0")).get_or_load(
        "public-config", new_load
    )
    assert fresh == {"shape": "new"}
    assert (len(old_calls), len(new_calls)) == (1, 1)
    assert release_fingerprint("a", "b") == release_fingerprint("a", "b") != release_fingerprint("a", "c")
