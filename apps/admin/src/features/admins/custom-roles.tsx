'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdminAccount, AdminPermission } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { AdminArea, PermissionAction, enumValues } from '@careerpilot/domain-ui-logic';
import { Button, Checkbox, ConfirmDialog, EmptyState, ErrorState, FormDialog, ListRow, LoadingState, Section, SelectField, TextField } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';

type Grants = Partial<Record<AdminArea, PermissionAction[]>>;

function toPermissions(grants: Grants): AdminPermission[] {
  return enumValues(AdminArea).flatMap((area) => {
    const actions = grants[area] ?? [];
    return actions.length > 0 ? [{ area, actions }] : [];
  });
}

function RoleCreateDialog() {
  const t = useT();
  const api = useAdminApi();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [grants, setGrants] = useState<Grants>({});
  const create = useAdminMutation(() => api.admins.createRole(name, toPermissions(grants)));
  const toggle = (area: AdminArea, action: PermissionAction) => {
    const current = grants[area] ?? [];
    setGrants({ ...grants, [area]: current.includes(action) ? current.filter((a) => a !== action) : [...current, action] });
  };
  const submit = () =>
    create.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        setName('');
        setGrants({});
      },
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('admin.roles.create')}</Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('admin.roles.create')}
        submitLabel={t('admin.roles.create')}
        submitting={create.isPending}
        error={create.isError ? t('admin.roles.createFailed') : undefined}
        onSubmit={submit}
      >
        <TextField label={t('admin.roles.name')} value={name} onChange={(e) => setName(e.target.value)} />
        {enumValues(AdminArea).map((area) => (
          <fieldset key={area} className="flex flex-wrap items-center gap-3">
            <legend className="text-sm font-medium text-foreground">{t(`enums.admin_area.${area}`)}</legend>
            {enumValues(PermissionAction).map((action) => (
              <Checkbox key={action} checked={(grants[area] ?? []).includes(action)} onChange={() => toggle(area, action)}>
                {t(`enums.permission_action.${action}`)}
              </Checkbox>
            ))}
          </fieldset>
        ))}
      </FormDialog>
    </>
  );
}

export function CustomRoles({ admins, canManage }: { admins: AdminAccount[]; canManage: boolean }) {
  const t = useT();
  const api = useAdminApi();
  const roles = useQuery({ queryKey: adminKeys.roles, queryFn: () => api.admins.listRoles() });
  const assign = useAdminMutation(({ roleId, adminId }: { roleId: string; adminId: string }) => api.admins.assignRole(roleId, adminId, true));
  const remove = useAdminMutation((id: string) => api.admins.deleteRole(id));
  if (roles.isPending) {
    return <LoadingState />;
  }
  if (roles.isError) {
    return <ErrorState onRetry={() => void roles.refetch()} />;
  }
  return (
    <Section title={t('admin.roles.title')} action={canManage ? <RoleCreateDialog /> : undefined}>
      {roles.data.length === 0 ? <EmptyState body={t('admin.roles.empty')} /> : null}
      {roles.data.map((role) => (
        <ListRow
          key={role.id}
          title={role.name}
          subtitle={t('admin.roles.members', { count: role.memberIds.length })}
          trailing={
            canManage ? (
              <span className="flex items-center gap-2">
                <SelectField
                  label={t('admin.roles.assign')}
                  value=""
                  placeholder={t('admin.roles.assign')}
                  options={admins.filter((a) => !role.memberIds.includes(a.id)).map((a) => ({ value: a.id, label: a.fullName }))}
                  onValueChange={(adminId) => adminId && assign.mutate({ roleId: role.id, adminId })}
                />
                <ConfirmDialog
                  title={t('admin.roles.deleteTitle', { name: role.name })}
                  body={t('admin.roles.deleteBody')}
                  confirmLabel={t('admin.roles.delete')}
                  destructive
                  onConfirm={() => remove.mutate(role.id)}
                  trigger={
                    <Button size="sm" variant="destructive">
                      {t('admin.roles.delete')}
                    </Button>
                  }
                />
              </span>
            ) : undefined
          }
        />
      ))}
    </Section>
  );
}
