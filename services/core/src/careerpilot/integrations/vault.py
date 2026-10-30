import base64
import json
import os
from collections.abc import Mapping

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from careerpilot.integrations.models import TokenSet
from careerpilot.integrations.ports import TokenCipher
from careerpilot.platform.config import VaultConfig
from careerpilot.platform.errors import DomainError, ErrorCode

KEY_BYTES = 32


def derive_key(secret: str, context: str) -> bytes:
    material = HKDF(algorithm=hashes.SHA256(), length=KEY_BYTES, salt=None, info=context.encode()).derive(secret.encode())
    return base64.urlsafe_b64encode(material)


def vault_secret(config: VaultConfig, token_secret: str, environ: Mapping[str, str] = os.environ) -> str:
    configured = environ.get(config.key_env, "").strip()
    return configured or token_secret


class FernetCipher:
    def __init__(self, secret: str, context: str) -> None:
        self._fernet = Fernet(derive_key(secret, context))

    def seal(self, plain: str) -> str:
        return self._fernet.encrypt(plain.encode()).decode()

    def unseal(self, sealed: str) -> str:
        try:
            return self._fernet.decrypt(sealed.encode()).decode()
        except InvalidToken as error:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE) from error


def seal_tokens(cipher: TokenCipher, tokens: TokenSet) -> str:
    payload = {"access": tokens.access_token, "refresh": tokens.refresh_token, "expires": tokens.expires_at}
    return cipher.seal(json.dumps(payload))


def unseal_tokens(cipher: TokenCipher, sealed: str) -> TokenSet:
    payload = json.loads(cipher.unseal(sealed))
    return TokenSet(access_token=str(payload["access"]), refresh_token=str(payload["refresh"]), expires_at=str(payload["expires"]))
