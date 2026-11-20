import base64
import hashlib
import hmac
import secrets
import struct
from urllib.parse import quote

from careerpilot.platform.config import MfaConfig

OTP_MASK = 0x7FFFFFFF
NIBBLE = 0x0F
DECIMAL_BASE = 10
RECOVERY_GROUP = 5


def new_secret(config: MfaConfig) -> str:
    return base64.b32encode(secrets.token_bytes(config.secret_bytes)).decode().rstrip("=")


def _key(secret: str) -> bytes:
    return base64.b32decode(secret + "=" * (-len(secret) % 8))


def time_step(config: MfaConfig, epoch_seconds: int) -> int:
    return epoch_seconds // config.period_seconds


def code_at(config: MfaConfig, secret: str, step: int) -> str:
    digest = hmac.new(_key(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & NIBBLE
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & OTP_MASK
    return str(number % DECIMAL_BASE**config.digits).zfill(config.digits)


def matching_step(config: MfaConfig, secret: str, code: str, epoch_seconds: int, after_step: int | None) -> int | None:
    current = time_step(config, epoch_seconds)
    for step in range(current - config.window_steps, current + config.window_steps + 1):
        if after_step is not None and step <= after_step:
            continue
        if hmac.compare_digest(code_at(config, secret, step), code):
            return step
    return None


def otpauth_uri(config: MfaConfig, issuer: str, account: str, secret: str) -> str:
    label = f"{quote(issuer)}:{quote(account)}"
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits={config.digits}&period={config.period_seconds}"


def new_recovery_code(config: MfaConfig) -> str:
    raw = secrets.token_hex(config.recovery_code_bytes)
    return "-".join(raw[i : i + RECOVERY_GROUP] for i in range(0, len(raw), RECOVERY_GROUP))


def normalized_recovery_code(code: str) -> str:
    return code.strip().lower()


def looks_like_totp(config: MfaConfig, code: str) -> bool:
    return len(code) == config.digits and code.isdigit()
