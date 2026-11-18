from careerpilot.administration.context import AdminActor, AdminContext
from careerpilot.administration.models import AdminPermission, CustomRole
from careerpilot.platform.enums import AdminArea, PermissionAction
from careerpilot.platform.errors import conflict, not_found, validation_error

ROLE_ID_PREFIX = "rol"
ROLE_DELETED_REASON = "deleted_by_super_admin"


class AdminRoleService:
    def __init__(self, context: AdminContext) -> None:
        self._ctx = context

    def all(self, actor: AdminActor) -> list[CustomRole]:
        actor.require(AdminArea.ADMINS, PermissionAction.READ)
        return self._ctx.directory.custom_roles()

    def create(self, actor: AdminActor, name: str, permissions: list[AdminPermission]) -> CustomRole:
        actor.require(AdminArea.ADMINS, PermissionAction.CREATE)
        clean = name.strip()
        if not clean:
            raise validation_error("name")
        if any(role.name.lower() == clean.lower() for role in self._ctx.directory.custom_roles()):
            raise conflict("role_exists")
        role = CustomRole(id=self._ctx.ids.next(ROLE_ID_PREFIX), name=clean, permissions=permissions)
        self._ctx.directory.save_custom_role(role)
        actor.record("role.created", role.name)
        return role

    def assign(self, actor: AdminActor, role_id: str, admin_id: str, assigned: bool) -> CustomRole:
        actor.require(AdminArea.ADMINS, PermissionAction.UPDATE)
        if self._ctx.admins.get(admin_id) is None:
            raise not_found("admin")
        roles = self._ctx.directory.custom_roles()
        role = self._find(roles, role_id)
        for other in roles:
            if other.id != role_id and admin_id in other.member_ids:
                other.member_ids.remove(admin_id)
                self._ctx.directory.save_custom_role(other)
        members = [m for m in role.member_ids if m != admin_id]
        role.member_ids = [*members, admin_id] if assigned else members
        self._ctx.directory.save_custom_role(role)
        actor.record("role.assigned" if assigned else "role.unassigned", f"{role.name} · {admin_id}")
        return role

    def delete(self, actor: AdminActor, role_id: str) -> None:
        actor.require(AdminArea.ADMINS, PermissionAction.DELETE)
        role = self._find(self._ctx.directory.custom_roles(), role_id)
        self._ctx.directory.remove_custom_role(role_id, ROLE_DELETED_REASON)
        actor.record("role.deleted", role.name)

    @staticmethod
    def _find(roles: list[CustomRole], role_id: str) -> CustomRole:
        role = next((r for r in roles if r.id == role_id), None)
        if role is None:
            raise not_found("role")
        return role
