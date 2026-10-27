import re
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlsplit

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import Session
from careerpilot.candidate.services.auth import ClientInfo, Registration
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)
DEMO_USER = "usr_demo"
CLIENT = ClientInfo(ip="127.0.0.1", device="pytest", approximate_location="Local")
TEST_SECRET = "unit-test-secret-that-is-long-enough-for-hmac"
STRONG_PASSWORD = "Str0ng!Password"
LINK_URL = re.compile(r"^https?://\S+$", re.MULTILINE)


def emailed_link(outbox: InMemoryEmailSender) -> str:
    match = LINK_URL.search(outbox.sent[-1].body)
    assert match is not None
    return match.group(0)


def link_token(outbox: InMemoryEmailSender) -> str:
    return parse_qs(urlsplit(emailed_link(outbox)).query)["token"][0]


def register_and_activate(
    container: Container, outbox: InMemoryEmailSender, registration: Registration, password: str = STRONG_PASSWORD
) -> Session:
    container.auth.register(registration, CLIENT)
    return container.auth.complete_link(link_token(outbox), password, CLIENT)


class FakeHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(NOW)


@pytest.fixture
def outbox() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def container(clock: FixedClock, outbox: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=sample_settings(),
        repositories=sample_repositories(load_sample_data(clock.now())),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=outbox,
    )
    return build_container(overrides)


@pytest.fixture
def empty_container(clock: FixedClock, outbox: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=load_settings("local"),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=outbox,
    )
    return build_container(overrides)
