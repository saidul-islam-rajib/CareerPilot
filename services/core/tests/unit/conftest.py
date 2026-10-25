from datetime import UTC, datetime

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.services.auth import ClientInfo
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.files import InMemoryFileStorage

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)
DEMO_USER = "usr_demo"
CLIENT = ClientInfo(ip="127.0.0.1", device="pytest", approximate_location="Local")
TEST_SECRET = "unit-test-secret-that-is-long-enough-for-hmac"


class FakeHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(NOW)


@pytest.fixture
def container(clock: FixedClock) -> Container:
    overrides = ContainerOverrides(
        settings=load_settings("local"),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
    )
    return build_container(overrides)
