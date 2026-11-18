import pytest

from careerpilot.administration.context import AdminActor
from careerpilot.administration.models import AdminPermission
from careerpilot.bootstrap import Container
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import AdminArea, AdminRole, PermissionAction
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.administration.test_admin_visibility import admin
from tests.unit.conftest import CLIENT, STRONG_PASSWORD, emailed_link, link_token

NEW_EMAIL = "new.admin@example.com"
NEW_NAME = "New Admin"
ROLE_NAME = "Source editors"
SOURCE_EDITING = [AdminPermission(area=AdminArea.SOURCES, actions=[PermissionAction.READ, PermissionAction.UPDATE])]


def test_super_admin_creates_an_admin_who_gets_a_password_link(container: Container, outbox: InMemoryEmailSender) -> None:
    created = container.admin_accounts.create(admin(container), NEW_NAME, NEW_EMAIL, AdminRole.SUPPORT)
    assert created.email == NEW_EMAIL
    assert emailed_link(outbox)
    assert NEW_EMAIL in [a.email for a in container.admin_accounts.list(admin(container))]


def test_creating_a_duplicate_admin_is_a_conflict(container: Container) -> None:
    container.admin_accounts.create(admin(container), NEW_NAME, NEW_EMAIL, AdminRole.SUPPORT)
    with pytest.raises(DomainError) as raised:
        container.admin_accounts.create(admin(container), NEW_NAME, NEW_EMAIL, AdminRole.SUPPORT)
    assert raised.value.code is ErrorCode.CONFLICT


def test_delete_removes_the_admin_and_never_the_actor(container: Container) -> None:
    actor = admin(container)
    created = container.admin_accounts.create(actor, NEW_NAME, NEW_EMAIL, AdminRole.SUPPORT)
    container.admin_accounts.delete(actor, created.id)
    assert created.id not in [a.id for a in container.admin_accounts.list(actor)]
    with pytest.raises(DomainError):
        container.admin_accounts.delete(actor, actor.summary.id)


def sign_in_as_new_admin(container: Container, outbox: InMemoryEmailSender, role: AdminRole) -> tuple[AdminActor, str]:
    created = container.admin_accounts.create(admin(container), NEW_NAME, NEW_EMAIL, role)
    session = container.admin_auth.complete_link(link_token(outbox), STRONG_PASSWORD, CLIENT.ip)
    return container.admin_auth.authenticate(session.access_token), created.id


def test_a_non_super_admin_cannot_create_or_delete(container: Container, outbox: InMemoryEmailSender) -> None:
    support, created_id = sign_in_as_new_admin(container, outbox, AdminRole.SUPPORT)
    with pytest.raises(DomainError) as raised:
        container.admin_accounts.create(support, "Other", "other@example.com", AdminRole.SUPPORT)
    assert raised.value.code is ErrorCode.FORBIDDEN
    with pytest.raises(DomainError):
        container.admin_accounts.delete(support, created_id)


def test_custom_role_replaces_base_permissions_and_can_be_deleted(container: Container) -> None:
    actor = admin(container)
    created = container.admin_accounts.create(actor, NEW_NAME, NEW_EMAIL, AdminRole.READ_ONLY)
    role = container.admin_roles.create(actor, ROLE_NAME, SOURCE_EDITING)
    container.admin_roles.assign(actor, role.id, created.id, True)
    assert [r.member_ids for r in container.admin_roles.all(actor)] == [[created.id]]
    container.admin_roles.delete(actor, role.id)
    assert container.admin_roles.all(actor) == []


def test_custom_role_grants_what_the_base_role_lacks(container: Container, outbox: InMemoryEmailSender) -> None:
    actor, admin_id = sign_in_as_new_admin(container, outbox, AdminRole.READ_ONLY)
    with pytest.raises(DomainError):
        actor.require(AdminArea.SOURCES, PermissionAction.UPDATE)
    role = container.admin_roles.create(admin(container), ROLE_NAME, SOURCE_EDITING)
    container.admin_roles.assign(admin(container), role.id, admin_id, True)
    actor.require(AdminArea.SOURCES, PermissionAction.UPDATE)
