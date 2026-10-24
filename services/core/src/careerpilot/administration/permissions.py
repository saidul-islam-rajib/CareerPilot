from careerpilot.administration.models import AdminPermission
from careerpilot.platform.enums import AdminArea, AdminRole, PermissionAction

ALL_ACTIONS = list(PermissionAction)
READ_ONLY = [PermissionAction.READ]
READ_UPDATE = [PermissionAction.READ, PermissionAction.UPDATE]

ROLE_RULES: dict[AdminRole, dict[AdminArea, list[PermissionAction]]] = {
    AdminRole.SUPER_ADMIN: {area: ALL_ACTIONS for area in AdminArea},
    AdminRole.SUPPORT: {
        AdminArea.DASHBOARD: READ_ONLY,
        AdminArea.USERS: READ_UPDATE,
        AdminArea.APPLICATIONS: READ_UPDATE,
        AdminArea.OPPORTUNITIES: READ_ONLY,
        AdminArea.AUDIT: READ_ONLY,
    },
    AdminRole.OPERATIONS: {
        AdminArea.DASHBOARD: READ_ONLY,
        AdminArea.SOURCES: READ_UPDATE,
        AdminArea.OPPORTUNITIES: READ_UPDATE,
        AdminArea.APPLICATIONS: READ_UPDATE,
        AdminArea.SETTINGS: READ_ONLY,
        AdminArea.AUDIT: READ_ONLY,
    },
    AdminRole.READ_ONLY: {area: READ_ONLY for area in AdminArea},
}


def permissions_for_role(role: AdminRole) -> list[AdminPermission]:
    return [AdminPermission(area=area, actions=list(actions)) for area, actions in ROLE_RULES[role].items()]


def can(role: AdminRole, area: AdminArea, action: PermissionAction) -> bool:
    return action in ROLE_RULES[role].get(area, [])
