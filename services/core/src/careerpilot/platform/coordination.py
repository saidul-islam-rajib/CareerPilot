import hashlib
import json
import logging
import random
from collections.abc import Callable
from enum import StrEnum
from typing import Any, TypeVar, cast

from careerpilot.platform.config import CoordinationConfig
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.keyvalue import KeyValueStore, StoreUnavailableError

SEPARATOR = ":"
FINGERPRINT_LENGTH = 32
CACHE_SCHEMA_VERSION = 1
RELEASE_LENGTH = 16
RELEASE_SEPARATOR = "|"
logger = logging.getLogger(__name__)
ResultT = TypeVar("ResultT")


class GuardScope(StrEnum):
    USER = "user"
    ADMIN = "admin"


class KeyNamespace(StrEnum):
    META = "meta"
    SIGN_IN_FAILURES = "auth:fail"
    AUTH_REQUESTS = "rl:auth"


def release_fingerprint(*parts: str) -> str:
    return hashlib.sha256(RELEASE_SEPARATOR.join(parts).encode()).hexdigest()[:RELEASE_LENGTH]


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()[:FINGERPRINT_LENGTH]


class KeySpace:
    def __init__(self, config: CoordinationConfig) -> None:
        self._root = (config.key_prefix, config.environment)

    def key(self, namespace: KeyNamespace, *parts: str) -> str:
        return SEPARATOR.join((*self._root, namespace.value, *parts))


class SignInGuard:
    def __init__(self, store: KeyValueStore, keys: KeySpace, config: CoordinationConfig) -> None:
        self._store = store
        self._keys = keys
        self._failures = config.sign_in_failures
        self._requests = config.auth_requests

    def throttle(self, scope: GuardScope, client_ip: str) -> None:
        key = self._keys.key(KeyNamespace.AUTH_REQUESTS, scope.value, fingerprint(client_ip))
        if self._fail_closed(lambda: self._store.increment(key, self._requests.window_seconds)) > self._requests.limit:
            raise DomainError(ErrorCode.TOO_MANY_ATTEMPTS)

    def ensure_allowed(self, scope: GuardScope, account: str, client_ip: str) -> None:
        self.throttle(scope, client_ip)
        failures = self._fail_closed(lambda: self._store.get(self._failure_key(scope, account)))
        if failures is not None and int(failures) >= self._failures.limit:
            raise DomainError(ErrorCode.TOO_MANY_ATTEMPTS)

    def record_failure(self, scope: GuardScope, account: str) -> None:
        self._fail_closed(lambda: self._store.increment(self._failure_key(scope, account), self._failures.window_seconds))

    def clear(self, scope: GuardScope, account: str) -> None:
        self._fail_closed(lambda: self._store.remove(self._failure_key(scope, account)))

    def _failure_key(self, scope: GuardScope, account: str) -> str:
        return self._keys.key(KeyNamespace.SIGN_IN_FAILURES, scope.value, fingerprint(account))

    @staticmethod
    def _fail_closed(operation: Callable[[], ResultT]) -> ResultT:
        try:
            return operation()
        except StoreUnavailableError as error:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE) from error


class MetadataCache:
    def __init__(
        self,
        store: KeyValueStore,
        keys: KeySpace,
        config: CoordinationConfig,
        jitter: Callable[[float, float], float] = random.uniform,
        release: str = "",
    ) -> None:
        self._store = store
        self._keys = keys
        self._version = f"v{CACHE_SCHEMA_VERSION}-{release}" if release else f"v{CACHE_SCHEMA_VERSION}"
        self._ttl = config.metadata_ttl_seconds
        self._jitter_ratio = config.ttl_jitter_ratio
        self._jitter = jitter

    def get_or_load(self, name: str, load: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        key = self._key(name)
        cached = self._fail_open(lambda: self._store.get(key))
        if cached is not None:
            return cast("dict[str, Any]", json.loads(cached))
        value = load()
        self._fail_open(lambda: self._store.put(key, json.dumps(value), self._ttl_with_jitter()))
        return value

    def invalidate(self, name: str) -> None:
        self._fail_open(lambda: self._store.remove(self._key(name)))

    def _key(self, name: str) -> str:
        return self._keys.key(KeyNamespace.META, name, self._version)

    def _ttl_with_jitter(self) -> int:
        spread = self._ttl * self._jitter_ratio
        return max(1, round(self._ttl + self._jitter(-spread, spread)))

    @staticmethod
    def _fail_open(operation: Callable[[], Any]) -> Any:
        try:
            return operation()
        except StoreUnavailableError:
            logger.warning("cache_unavailable", exc_info=True)
            return None
