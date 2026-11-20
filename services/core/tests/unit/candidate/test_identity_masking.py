import pytest

from careerpilot.administration.context import PageRequest
from careerpilot.bootstrap import Container
from careerpilot.platform.errors import DomainError
from tests.unit.administration.test_admin_services import actor
from tests.unit.candidate.test_bangladesh_profile import identity
from tests.unit.conftest import DEMO_USER

NID = "1998123456789"
REVEAL_ACTION = "profile.revealed_sensitive_field"


def stored_identity(container: Container) -> str:
    profile = container.profile.add_entry(DEMO_USER, "identity", identity(nid_number=NID, passport_number="BX1234567"))
    return container.profile.view(profile, "http://api.test/").sections["identity"][0].id


def view_values(container: Container) -> dict[str, object]:
    profile = container.profile.get(DEMO_USER)
    return dict(container.profile.view(profile, "http://api.test/").sections["identity"][0].values)


def test_sensitive_fields_are_masked_in_the_profile_view(container: Container) -> None:
    stored_identity(container)
    values = view_values(container)
    assert values["nid_number"] == "•••6789"
    assert values["passport_number"] == "•••4567"
    assert values["name_english"] == "Ayesha Rahman"


def test_reveal_returns_the_value_and_is_audited(container: Container) -> None:
    entry_id = stored_identity(container)
    assert container.profile.reveal_field(DEMO_USER, "identity", entry_id, "nid_number") == NID
    events = [e for e in container.admin_audit.list(actor(container), PageRequest(page_size=50)).items if e.action == REVEAL_ACTION]
    assert [e.target for e in events] == ["identity.nid_number"]


def test_reveal_refuses_fields_that_are_not_sensitive(container: Container) -> None:
    entry_id = stored_identity(container)
    with pytest.raises(DomainError):
        container.profile.reveal_field(DEMO_USER, "identity", entry_id, "name_english")


def test_saving_the_masked_value_keeps_the_stored_one(container: Container) -> None:
    entry_id = stored_identity(container)
    container.profile.update_entry(DEMO_USER, "identity", entry_id, identity(nid_number="•••6789", passport_number="•••4567"))
    assert container.profile.reveal_field(DEMO_USER, "identity", entry_id, "nid_number") == NID
    container.profile.update_entry(DEMO_USER, "identity", entry_id, identity(nid_number="1111222233", passport_number="•••4567"))
    assert container.profile.reveal_field(DEMO_USER, "identity", entry_id, "nid_number") == "1111222233"
