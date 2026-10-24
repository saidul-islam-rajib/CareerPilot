import { AdminArea, AdminRole, PermissionAction, enumValues } from '@careerpilot/domain-ui-logic';
import type { AdminPermission } from './admin-types';

const ALL_ACTIONS = enumValues(PermissionAction);
const READ_ONLY = [PermissionAction.Read];
const READ_UPDATE = [PermissionAction.Read, PermissionAction.Update];

const ROLE_RULES: Record<AdminRole, Partial<Record<AdminArea, PermissionAction[]>>> = {
  [AdminRole.SuperAdmin]: Object.fromEntries(enumValues(AdminArea).map((area) => [area, ALL_ACTIONS])),
  [AdminRole.Support]: {
    [AdminArea.Dashboard]: READ_ONLY,
    [AdminArea.Users]: READ_UPDATE,
    [AdminArea.Applications]: READ_UPDATE,
    [AdminArea.Opportunities]: READ_ONLY,
    [AdminArea.Audit]: READ_ONLY,
  },
  [AdminRole.Operations]: {
    [AdminArea.Dashboard]: READ_ONLY,
    [AdminArea.Sources]: READ_UPDATE,
    [AdminArea.Opportunities]: READ_UPDATE,
    [AdminArea.Applications]: READ_UPDATE,
    [AdminArea.Settings]: READ_ONLY,
    [AdminArea.Audit]: READ_ONLY,
  },
  [AdminRole.ReadOnly]: Object.fromEntries(enumValues(AdminArea).map((area) => [area, READ_ONLY])),
};

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  return Object.entries(ROLE_RULES[role]).map(([area, actions]) => ({ area: area as AdminArea, actions: actions ?? [] }));
}

export function can(permissions: readonly AdminPermission[], area: AdminArea, action: PermissionAction): boolean {
  return permissions.some((p) => p.area === area && p.actions.includes(action));
}
