from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.integrations.models import MailMessage
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import DEMO_USER, NOW, TEST_SECRET, FakeHasher

CLIENT_ID_ENV = "CAREERPILOT_GOOGLE_CLIENT_ID"
CLIENT_SECRET_ENV = "CAREERPILOT_GOOGLE_CLIENT_SECRET"
CLIENT_ID = "client-id.apps.example.test"
EMPLOYER = "careers@baydigital.example.com"


@pytest.fixture
def gateway() -> FakeGoogleGateway:
    return FakeGoogleGateway(email="ayesha@gmail.com", scopes=list(sample_settings().integrations.google.scopes))


@pytest.fixture
def google(clock: FixedClock, outbox: InMemoryEmailSender, gateway: FakeGoogleGateway, monkeypatch: pytest.MonkeyPatch) -> Container:
    monkeypatch.setenv(CLIENT_ID_ENV, CLIENT_ID)
    monkeypatch.setenv(CLIENT_SECRET_ENV, "client-secret")
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
            google_gateway=gateway,
        )
    )


def state_of(url: str) -> str:
    return parse_qs(urlsplit(url).query)["state"][0]


def connect(container: Container, code: str = "auth-code") -> str:
    url = container.integrations.google.authorize_url(DEMO_USER).url
    return container.integrations.google.complete(state_of(url), code, None)


def mail(message_id: str, sender: str, subject: str, body: str = "", *, name: str = "", minutes_ago: int = 30) -> MailMessage:
    return MailMessage(message_id, sender, name, subject, body, NOW - timedelta(minutes=minutes_ago))
