import os
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol

import jwt
from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError

from careerpilot.platform.clock import Clock
from careerpilot.platform.config import SecurityConfig
from careerpilot.platform.errors import DomainError, ErrorCode

TOKEN_SECRET_ENV = "CAREERPILOT_TOKEN_SECRET"
GENERATED_SECRET_BYTES = 48


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password_hash: str, password: str) -> bool: ...


class Argon2PasswordHasher:
    def __init__(self) -> None:
        self._hasher = Argon2Hasher()

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except (VerificationError, InvalidHashError):
            return False


@dataclass(frozen=True)
class TokenClaims:
    subject: str
    audience: str
    issued_at: int


class TokenService:
    def __init__(self, config: SecurityConfig, clock: Clock, secret: str) -> None:
        self._config = config
        self._clock = clock
        self._secret = secret

    def issue(self, subject: str, audience: str, ttl_minutes: int) -> str:
        issued = self._clock.now()
        payload = {
            "sub": subject,
            "aud": audience,
            "iss": self._config.token_issuer,
            "iat": issued,
            "exp": issued + timedelta(minutes=ttl_minutes),
        }
        return jwt.encode(payload, self._secret, algorithm=self._config.token_algorithm)  # pyright: ignore[reportUnknownMemberType]

    def verify(self, token: str, audience: str) -> TokenClaims:
        try:
            payload = jwt.decode(  # pyright: ignore[reportUnknownMemberType]
                token,
                self._secret,
                algorithms=[self._config.token_algorithm],
                audience=audience,
                issuer=self._config.token_issuer,
                options={"verify_exp": False},
            )
        except jwt.PyJWTError as error:
            raise DomainError(ErrorCode.UNAUTHORIZED) from error
        if int(payload["exp"]) <= int(self._clock.now().timestamp()):
            raise DomainError(ErrorCode.UNAUTHORIZED)
        return TokenClaims(subject=str(payload["sub"]), audience=audience, issued_at=int(payload["iat"]))


def token_secret_from_environment() -> str:
    return os.environ.get(TOKEN_SECRET_ENV) or secrets.token_urlsafe(GENERATED_SECRET_BYTES)
