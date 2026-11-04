from dataclasses import dataclass, field

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from careerpilot.writing.enums import DraftSource, WritingKind
from careerpilot.writing.models import Generated, WritingRequest
from careerpilot.writing.ports import GenerationRefusedError, GenerationUnavailableError
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher

OPPORTUNITY = "opp_remote_frontend"
OTHER_OPPORTUNITY = "opp_intl_oslo"
APPROVAL = "apr_frontend"
OSLO_APPROVAL = "apr_oslo"
FAKE_MODEL = "fake-model"
USER = DEMO_USER


@dataclass
class FakeWriter:
    text: str = "Dear Northwind Labs hiring team, I build React and TypeScript interfaces."
    unavailable: bool = False
    refused: bool = False
    calls: list[WritingRequest] = field(default_factory=list[WritingRequest])

    @property
    def model(self) -> str | None:
        return FAKE_MODEL

    def supports(self, kind: WritingKind) -> bool:
        return True

    def generate(self, request: WritingRequest) -> Generated:
        self.calls.append(request)
        if self.unavailable:
            raise GenerationUnavailableError
        if self.refused:
            raise GenerationRefusedError
        return Generated(text=self.text, source=DraftSource.AI, model=FAKE_MODEL)


def build(clock: FixedClock, outbox: InMemoryEmailSender, writer: FakeWriter | None) -> Container:
    return build_container(
        ContainerOverrides(
            settings=sample_settings(),
            repositories=sample_repositories(load_sample_data(clock.now())),
            clock=clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=InMemoryFileStorage(),
            email_sender=outbox,
            ai_writer=writer,
        )
    )


@pytest.fixture
def writer() -> FakeWriter:
    return FakeWriter()


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(sample_settings().writing.api_key_env, raising=False)


@pytest.fixture
def container(clock: FixedClock, outbox: InMemoryEmailSender) -> Container:
    return build(clock, outbox, None)


@pytest.fixture
def ai_container(clock: FixedClock, outbox: InMemoryEmailSender, writer: FakeWriter) -> Container:
    return build(clock, outbox, writer)
