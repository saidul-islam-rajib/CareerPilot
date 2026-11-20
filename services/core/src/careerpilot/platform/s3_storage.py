import hashlib
import hmac
from collections.abc import Callable
from datetime import datetime
from typing import Protocol
from urllib.parse import quote, urlsplit

import httpx

from careerpilot.platform.clock import Clock
from careerpilot.platform.config import S3Config
from careerpilot.platform.files import require_key

ALGORITHM = "AWS4-HMAC-SHA256"
SERVICE = "s3"
TERMINATOR = "aws4_request"
AMZ_DATE_FORMAT = "%Y%m%dT%H%M%SZ"
DATE_FORMAT = "%Y%m%d"
SAFE_CHARACTERS = "-_.~"
SAFE_PATH_CHARACTERS = "/-_.~"
HTTP_NOT_FOUND = 404
HTTP_ERROR_FLOOR = 400
UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD"
EMPTY_PAYLOAD_HASH = hashlib.sha256(b"").hexdigest()


class StorageCredentialsError(RuntimeError):
    pass


class StorageRequestError(RuntimeError):
    pass


class S3Credentials:
    def __init__(self, access_key: str, secret_key: str) -> None:
        self.access_key = access_key
        self.secret_key = secret_key


class ObjectClient(Protocol):
    def put_object(self, key: str, data: bytes) -> None: ...

    def get_object(self, key: str) -> bytes | None: ...

    def presign_get(self, key: str, ttl_seconds: int) -> str: ...


def credentials_from(config: S3Config, read_env: Callable[[str], str | None]) -> S3Credentials:
    access_key = read_env(config.access_key_env)
    secret_key = read_env(config.secret_key_env)
    if not access_key or not secret_key:
        raise StorageCredentialsError(config.access_key_env)
    return S3Credentials(access_key, secret_key)


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hmac(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode(), hashlib.sha256).digest()


class SigV4Signer:
    def __init__(self, credentials: S3Credentials, region: str) -> None:
        self._credentials = credentials
        self._region = region

    def scope(self, moment: datetime) -> str:
        return f"{moment.strftime(DATE_FORMAT)}/{self._region}/{SERVICE}/{TERMINATOR}"

    def credential(self, moment: datetime) -> str:
        return f"{self._credentials.access_key}/{self.scope(moment)}"

    def signature(self, moment: datetime, canonical_request: str) -> str:
        to_sign = "\n".join([ALGORITHM, moment.strftime(AMZ_DATE_FORMAT), self.scope(moment), _sha256_hex(canonical_request.encode())])
        key = _hmac(("AWS4" + self._credentials.secret_key).encode(), moment.strftime(DATE_FORMAT))
        for part in (self._region, SERVICE, TERMINATOR):
            key = _hmac(key, part)
        return hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()


class S3ObjectClient:
    def __init__(self, config: S3Config, credentials: S3Credentials, clock: Clock, http: httpx.Client) -> None:
        self._config = config
        self._clock = clock
        self._http = http
        self._signer = SigV4Signer(credentials, config.region)
        endpoint = urlsplit(config.endpoint)
        self._scheme = endpoint.scheme
        self._host = endpoint.netloc

    def put_object(self, key: str, data: bytes) -> None:
        response = self._http.put(self._url(key), content=data, headers=self._signed_headers("PUT", key, _sha256_hex(data)))
        if response.status_code >= HTTP_ERROR_FLOOR:
            raise StorageRequestError(response.status_code)

    def get_object(self, key: str) -> bytes | None:
        response = self._http.get(self._url(key), headers=self._signed_headers("GET", key, EMPTY_PAYLOAD_HASH))
        if response.status_code == HTTP_NOT_FOUND:
            return None
        if response.status_code >= HTTP_ERROR_FLOOR:
            raise StorageRequestError(response.status_code)
        return response.content

    def presign_get(self, key: str, ttl_seconds: int) -> str:
        moment = self._clock.now()
        query = {
            "X-Amz-Algorithm": ALGORITHM,
            "X-Amz-Credential": self._signer.credential(moment),
            "X-Amz-Date": moment.strftime(AMZ_DATE_FORMAT),
            "X-Amz-Expires": str(ttl_seconds),
            "X-Amz-SignedHeaders": "host",
        }
        canonical_query = self._canonical_query(query)
        canonical = "\n".join(["GET", self._path(key), canonical_query, f"host:{self._host}\n", "host", UNSIGNED_PAYLOAD])
        signature = self._signer.signature(moment, canonical)
        return f"{self._scheme}://{self._host}{self._path(key)}?{canonical_query}&X-Amz-Signature={signature}"

    def _path(self, key: str) -> str:
        return "/" + quote(f"{self._config.bucket}/{require_key(key)}", safe=SAFE_PATH_CHARACTERS)

    def _url(self, key: str) -> str:
        return f"{self._scheme}://{self._host}{self._path(key)}"

    @staticmethod
    def _canonical_query(query: dict[str, str]) -> str:
        pairs = sorted(query.items())
        return "&".join(f"{quote(name, safe=SAFE_CHARACTERS)}={quote(value, safe=SAFE_CHARACTERS)}" for name, value in pairs)

    def _signed_headers(self, method: str, key: str, payload_hash: str) -> dict[str, str]:
        moment = self._clock.now()
        headers = {"host": self._host, "x-amz-content-sha256": payload_hash, "x-amz-date": moment.strftime(AMZ_DATE_FORMAT)}
        names = sorted(headers)
        canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in names)
        signed = ";".join(names)
        canonical = "\n".join([method, self._path(key), "", canonical_headers, signed, payload_hash])
        signature = self._signer.signature(moment, canonical)
        authorization = f"{ALGORITHM} Credential={self._signer.credential(moment)}, SignedHeaders={signed}, Signature={signature}"
        return {**headers, "Authorization": authorization}


class S3FileStorage:
    def __init__(self, client: ObjectClient, link_ttl_seconds: int) -> None:
        self._client = client
        self._link_ttl_seconds = link_ttl_seconds

    def put(self, key: str, data: bytes) -> None:
        self._client.put_object(require_key(key), data)

    def get(self, key: str) -> bytes | None:
        return self._client.get_object(require_key(key))

    def signed_link(self, key: str) -> str:
        return self._client.presign_get(require_key(key), self._link_ttl_seconds)
