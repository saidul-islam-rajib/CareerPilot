import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.privacy.enums import ConsentKind, ConsentSource
from tests.unit.conftest import CLIENT, register_and_activate


def registered(container: Container, outbox: InMemoryEmailSender) -> str:
    registration = Registration("Nadia Rahman", "nadia@sober.com", True, "0.9", "0.8")
    return register_and_activate(container, outbox, registration).user.id


def granted(container: Container, user_id: str) -> dict[ConsentKind, bool]:
    return {entry.kind: entry.granted for entry in container.privacy.consents.overview(user_id).current}


def test_registration_records_the_accepted_versions_with_ip_and_device(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    user_id = registered(empty_container, outbox)
    history = empty_container.privacy.consents.overview(user_id).history
    assert {(r.kind, r.version) for r in history} == {(ConsentKind.TERMS, "0.9"), (ConsentKind.PRIVACY, "0.8")}
    assert all(r.granted and r.source is ConsentSource.REGISTRATION and r.ip == CLIENT.ip and r.device == CLIENT.device for r in history)


def test_optional_consents_start_off_and_required_ones_are_on(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    state = granted(empty_container, registered(empty_container, outbox))
    assert state[ConsentKind.TERMS]
    assert state[ConsentKind.PRIVACY]
    assert not any(
        state[kind] for kind in (ConsentKind.ANALYTICS, ConsentKind.MARKETING, ConsentKind.AI_IMPROVEMENT, ConsentKind.PRECISE_LOCATION)
    )


def test_each_change_appends_a_record_and_history_is_never_rewritten(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    user_id = registered(empty_container, outbox)
    consents = empty_container.privacy.consents
    consents.update(user_id, ConsentKind.MARKETING, True, CLIENT)
    consents.update(user_id, ConsentKind.MARKETING, True, CLIENT)
    after_on = consents.overview(user_id)
    assert len(after_on.history) == 3
    consents.update(user_id, ConsentKind.MARKETING, False, CLIENT)
    after_off = consents.overview(user_id)
    assert len(after_off.history) == 4
    assert after_off.history[0].granted is False
    assert after_off.history[0].kind is ConsentKind.MARKETING
    assert {r.id for r in after_on.history} <= {r.id for r in after_off.history}
    assert not granted(empty_container, user_id)[ConsentKind.MARKETING]


def test_required_consents_cannot_be_withdrawn_here(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    user_id = registered(empty_container, outbox)
    with pytest.raises(DomainError) as error:
        empty_container.privacy.consents.update(user_id, ConsentKind.TERMS, False, CLIENT)
    assert error.value.code is ErrorCode.VALIDATION
