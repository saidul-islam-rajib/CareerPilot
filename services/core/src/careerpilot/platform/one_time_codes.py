import hashlib
import hmac
import secrets
from collections.abc import Callable
from enum import StrEnum
from typing import TypeVar

from careerpilot.platform.config import VerificationConfig
from careerpilot.platform.coordination import KeyNamespace, KeySpace
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.keyvalue import KeyValueStore, StoreUnavailableError

ResultT = TypeVar("ResultT")
DECIMAL_BASE = 10
HOUR_SECONDS = 3600
CODE_KEY = "code"
ATTEMPTS_KEY = "attempts"
COOLDOWN_KEY = "cooldown"
SENDS_KEY = "sends"


class CodeCheck(StrEnum):
    VALID = "valid"
    INVALID = "invalid"
    EXPIRED = "expired"
    LOCKED = "locked"


class SendRefusal(StrEnum):
    COOLDOWN = "resend_cooldown"
    LIMIT = "send_limit"


def random_code(length: int) -> str:
    return str(secrets.randbelow(DECIMAL_BASE**length)).zfill(length)


class OneTimeCodes:
    def __init__(
        self,
        store: KeyValueStore,
        keys: KeySpace,
        config: VerificationConfig,
        secret: str,
        generate: Callable[[int], str] = random_code,
    ) -> None:
        self._store = store
        self._keys = keys
        self._config = config
        self._secret = secret.encode()
        self._generate = generate

    def issue(self, purpose: str, target: str) -> str:
        self._ensure_can_send(purpose, target)
        code = self._generate(self._config.code_length)
        ttl = self._config.code_ttl_seconds
        self._fail_closed(lambda: self._store.put(self._key(purpose, target, CODE_KEY), self._digest(target, code), ttl))
        self._fail_closed(lambda: self._store.remove(self._key(purpose, target, ATTEMPTS_KEY)))
        cooldown = self._config.resend_cooldown_seconds
        if cooldown > 0:
            self._fail_closed(lambda: self._store.put(self._key(purpose, target, COOLDOWN_KEY), "1", cooldown))
        self._fail_closed(lambda: self._store.increment(self._key(purpose, target, SENDS_KEY), HOUR_SECONDS))
        return code

    def withdraw(self, purpose: str, target: str) -> None:
        for part in (CODE_KEY, ATTEMPTS_KEY, COOLDOWN_KEY):
            key = self._key(purpose, target, part)
            self._fail_closed(lambda key=key: self._store.remove(key))

    def check(self, purpose: str, target: str, code: str) -> CodeCheck:
        stored = self._fail_closed(lambda: self._store.get(self._key(purpose, target, CODE_KEY)))
        if stored is None:
            return CodeCheck.EXPIRED
        if hmac.compare_digest(stored, self._digest(target, code.strip())):
            self._fail_closed(lambda: self._store.remove(self._key(purpose, target, CODE_KEY)))
            self._fail_closed(lambda: self._store.remove(self._key(purpose, target, ATTEMPTS_KEY)))
            return CodeCheck.VALID
        attempts_key = self._key(purpose, target, ATTEMPTS_KEY)
        attempts = self._fail_closed(lambda: self._store.increment(attempts_key, self._config.code_ttl_seconds))
        if attempts >= self._config.max_attempts:
            self._fail_closed(lambda: self._store.remove(self._key(purpose, target, CODE_KEY)))
            return CodeCheck.LOCKED
        return CodeCheck.INVALID

    def resend_after(self, purpose: str, target: str) -> int:
        return max(0, self._fail_closed(lambda: self._store.seconds_left(self._key(purpose, target, COOLDOWN_KEY))))

    def _ensure_can_send(self, purpose: str, target: str) -> None:
        if self.resend_after(purpose, target) > 0:
            raise DomainError(ErrorCode.TOO_MANY_ATTEMPTS, SendRefusal.COOLDOWN.value)
        sends = self._fail_closed(lambda: self._store.get(self._key(purpose, target, SENDS_KEY)))
        if sends is not None and int(sends) >= self._config.sends_per_hour:
            raise DomainError(ErrorCode.TOO_MANY_ATTEMPTS, SendRefusal.LIMIT.value)

    def _digest(self, target: str, code: str) -> str:
        return hmac.new(self._secret, f"{target}:{code}".encode(), hashlib.sha256).hexdigest()

    def _key(self, purpose: str, target: str, part: str) -> str:
        return self._keys.key(KeyNamespace.ONE_TIME_CODES, purpose, target, part)

    @staticmethod
    def _fail_closed(operation: Callable[[], ResultT]) -> ResultT:
        try:
            return operation()
        except StoreUnavailableError as error:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE) from error
