from datetime import UTC, datetime

import httpx
import pytest

from careerpilot.bootstrap import file_storage_for
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.config import load_settings
from careerpilot.platform.enums import StorageBackend
from careerpilot.platform.files import LocalFileStorage, StorageKeyError
from careerpilot.platform.s3_storage import (
    S3Credentials,
    S3FileStorage,
    S3ObjectClient,
    StorageCredentialsError,
    StorageRequestError,
    credentials_from,
)

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)
TTL = 900


class FakeBucket:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.requests: list[httpx.Request] = []
        self.fail = False

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.fail:
            return httpx.Response(500)
        path = request.url.path
        if request.method == "PUT":
            self.objects[path] = request.content
            return httpx.Response(200)
        data = self.objects.get(path)
        return httpx.Response(200, content=data) if data is not None else httpx.Response(404)


def build(bucket: FakeBucket) -> tuple[S3FileStorage, S3ObjectClient]:
    config = load_settings("local").profile.storage.s3
    http = httpx.Client(transport=httpx.MockTransport(bucket.handle))
    client = S3ObjectClient(config, S3Credentials("access", "secret"), FixedClock(NOW), http)
    return S3FileStorage(client, TTL), client


def test_put_then_get_round_trips_through_the_bucket() -> None:
    bucket = FakeBucket()
    storage, _ = build(bucket)
    storage.put("users/u1/photo.png", b"data")
    assert storage.get("users/u1/photo.png") == b"data"
    assert "/careerpilot-files/users/u1/photo.png" in bucket.objects


def test_missing_object_is_none() -> None:
    storage, _ = build(FakeBucket())
    assert storage.get("users/u1/none.png") is None


def test_requests_are_signed_with_sigv4() -> None:
    bucket = FakeBucket()
    storage, _ = build(bucket)
    storage.put("a/b.pdf", b"x")
    request = bucket.requests[0]
    authorization = request.headers["Authorization"]
    assert authorization.startswith("AWS4-HMAC-SHA256 Credential=access/20261020/us-east-1/s3/aws4_request")
    assert "SignedHeaders=host;x-amz-content-sha256;x-amz-date" in authorization
    assert request.headers["x-amz-date"] == "20261020T060000Z"


def test_signing_is_deterministic_for_a_fixed_clock() -> None:
    first, second = FakeBucket(), FakeBucket()
    build(first)[0].put("a/b.pdf", b"x")
    build(second)[0].put("a/b.pdf", b"x")
    assert first.requests[0].headers["Authorization"] == second.requests[0].headers["Authorization"]


def test_server_errors_raise() -> None:
    bucket = FakeBucket()
    bucket.fail = True
    storage, _ = build(bucket)
    with pytest.raises(StorageRequestError):
        storage.put("a/b.pdf", b"x")
    with pytest.raises(StorageRequestError):
        storage.get("a/b.pdf")


def test_signed_link_carries_expiry_and_signature() -> None:
    storage, _ = build(FakeBucket())
    link = storage.signed_link("a/b.pdf")
    assert link.startswith("http://localhost:9000/careerpilot-files/a/b.pdf?")
    assert f"X-Amz-Expires={TTL}" in link
    assert "X-Amz-Signature=" in link
    assert "secret" not in link


def test_bad_keys_are_rejected() -> None:
    storage, _ = build(FakeBucket())
    with pytest.raises(StorageKeyError):
        storage.put("../escape", b"x")


def test_credentials_come_from_the_named_environment_variables() -> None:
    config = load_settings("local").profile.storage.s3
    values: dict[str, str] = {config.access_key_env: "a", config.secret_key_env: "s"}
    none: dict[str, str] = {}
    assert credentials_from(config, values.get).access_key == "a"
    with pytest.raises(StorageCredentialsError):
        credentials_from(config, none.get)


def test_backend_is_chosen_by_configuration() -> None:
    settings = load_settings("local")
    assert settings.profile.storage.backend is StorageBackend.LOCAL
    assert isinstance(file_storage_for(settings, FixedClock(NOW)), LocalFileStorage)
    production = load_settings("production")
    assert production.profile.storage.backend is StorageBackend.S3
