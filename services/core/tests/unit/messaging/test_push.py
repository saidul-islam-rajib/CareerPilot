from typing import Any

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import DevicePlatform, NotificationKind
from careerpilot.platform.errors import DomainError
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.push import ExpoPushSender, InMemoryPushSender, PushMessage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import CLIENT, DEMO_USER, TEST_SECRET, FakeHasher
from tests.unit.messaging.test_messaging import LINK, OTHER, add_member, karim

TOKEN = "ExponentPushToken[demoDevice123]"
OTHER_TOKEN = "ExponentPushToken[karimPhone456]"
GONE_TOKEN = "ExponentPushToken[uninstalled789]"


@pytest.fixture
def pushes() -> InMemoryPushSender:
    return InMemoryPushSender(unregistered=frozenset({GONE_TOKEN}))


@pytest.fixture
def phone(clock: FixedClock, outbox: InMemoryEmailSender, pushes: InMemoryPushSender) -> Container:
    container = build_container(
        ContainerOverrides(
            settings=sample_settings(),
            repositories=sample_repositories(load_sample_data(clock.now())),
            clock=clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=InMemoryFileStorage(),
            email_sender=outbox,
            push_sender=pushes,
        )
    )
    add_member(container, OTHER, "Karim Hasan", "karim@example.org")
    return container


def test_devices_are_validated_moved_between_users_and_capped(phone: Container) -> None:
    with pytest.raises(DomainError) as invalid:
        phone.notifications.register_device(DEMO_USER, "not-a-token", DevicePlatform.ANDROID)
    assert invalid.value.detail == "push_token"
    phone.notifications.register_device(OTHER, TOKEN, DevicePlatform.ANDROID)
    phone.notifications.register_device(DEMO_USER, TOKEN, DevicePlatform.ANDROID)
    assert [d.token for d in phone.messaging._ctx.notifications._ctx.devices.for_user(OTHER)] == []  # pyright: ignore[reportPrivateUsage]
    for index in range(phone.settings.messaging.push.max_devices_per_user + 2):
        phone.notifications.register_device(DEMO_USER, f"ExpoPushToken[extra{index}]", DevicePlatform.IOS)
    devices = phone.messaging._ctx.notifications._ctx.devices.for_user(DEMO_USER)  # pyright: ignore[reportPrivateUsage]
    assert len(devices) == phone.settings.messaging.push.max_devices_per_user
    assert TOKEN not in [d.token for d in devices]


def test_every_message_pushes_to_the_other_members_phones_but_not_when_muted(phone: Container, pushes: InMemoryPushSender) -> None:
    phone.notifications.register_device(DEMO_USER, TOKEN, DevicePlatform.ANDROID)
    phone.notifications.register_device(OTHER, OTHER_TOKEN, DevicePlatform.ANDROID)
    chat = phone.messaging.start(OTHER, DEMO_USER, LINK)
    phone.messaging.send(karim(), chat.id, "Hi Ayesha", None, LINK)
    phone.messaging.send(karim(), chat.id, "Are you free today?", None, LINK)
    assert [(m.to, m.title, m.body) for m in pushes.sent] == [
        ([TOKEN], "Karim Hasan", "Hi Ayesha"),
        ([TOKEN], "Karim Hasan", "Are you free today?"),
    ]
    assert pushes.sent[0].data == {"kind": NotificationKind.MESSAGE.value, "target": "conversation", "targetId": chat.id}
    assert len(phone.notifications.recent(DEMO_USER)) == 1
    phone.messaging.mute(DEMO_USER, chat.id, True)
    phone.messaging.send(karim(), chat.id, "Hello?", None, LINK)
    assert len(pushes.sent) == 2


def test_uninstalled_apps_are_forgotten_after_a_push(phone: Container, pushes: InMemoryPushSender) -> None:
    phone.notifications.register_device(DEMO_USER, TOKEN, DevicePlatform.ANDROID)
    phone.notifications.register_device(DEMO_USER, GONE_TOKEN, DevicePlatform.ANDROID)
    chat = phone.messaging.start(OTHER, DEMO_USER, LINK)
    phone.messaging.send(karim(), chat.id, "First", None, LINK)
    phone.messaging.send(karim(), chat.id, "Second", None, LINK)
    assert [m.to for m in pushes.sent] == [[TOKEN, GONE_TOKEN], [TOKEN]]


def test_signing_out_on_a_phone_stops_its_pushes(phone: Container, pushes: InMemoryPushSender) -> None:
    phone.notifications.register_device(DEMO_USER, TOKEN, DevicePlatform.ANDROID)
    phone.notifications.unregister_device(OTHER, TOKEN)
    phone.notifications.unregister_device(DEMO_USER, TOKEN)
    chat = phone.messaging.start(OTHER, DEMO_USER, LINK)
    phone.messaging.send(karim(), chat.id, "Anyone there?", None, LINK)
    assert pushes.sent == []


def test_expo_sender_batches_messages_and_reports_unregistered_tokens(phone: Container) -> None:
    calls: list[tuple[str, list[dict[str, Any]]]] = []

    def post(url: str, payload: list[dict[str, Any]], timeout: float) -> Any:
        calls.append((url, payload))
        return {
            "data": [{"status": "ok", "id": "t1"}] + [{"status": "error", "details": {"error": "DeviceNotRegistered"}}] * (len(payload) - 1)
        }

    config = phone.settings.messaging.push.model_copy(update={"batch_size": 2})
    gone = ExpoPushSender(config, post).send(PushMessage(to=["a", "b", "c"], title="T", body="B", data={"k": "v"}))
    assert [len(payload) for _, payload in calls] == [2, 1]
    assert calls[0][0] == config.endpoint
    assert calls[0][1][0] == {
        "to": "a",
        "title": "T",
        "body": "B",
        "data": {"k": "v"},
        "sound": "default",
        "priority": "high",
        "channelId": "updates",
    }
    assert gone == ["b"]


def test_push_device_endpoints(phone: Container) -> None:
    client = TestClient(create_user_app(phone))
    token = phone.auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT).access_token
    headers = {"Authorization": f"Bearer {token}"}
    assert client.put("/v1/push-devices", json={"token": TOKEN, "platform": "android"}, headers=headers).status_code == 204
    assert client.put("/v1/push-devices", json={"token": "bad", "platform": "android"}, headers=headers).status_code == 422
    assert client.put("/v1/push-devices", json={"token": TOKEN, "platform": "windows"}, headers=headers).status_code == 422
    assert client.post("/v1/push-devices/remove", json={"token": TOKEN}, headers=headers).status_code == 204
    assert client.put("/v1/push-devices", json={"token": TOKEN, "platform": "android"}).status_code == 401
