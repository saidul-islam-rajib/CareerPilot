'use client';

import { useState } from 'react';
import { useEnumDisplay, useT } from '@careerpilot/client-core';
import { AdminRole, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import { Button, FormDialog, SelectField, TextField } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';
import { useAdminMutation } from '@/core/admin-queries';

export function AdminCreateDialog() {
  const t = useT();
  const api = useAdminApi();
  const display = useEnumDisplay();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>(AdminRole.Support);
  const create = useAdminMutation(() => api.admins.createAdmin({ fullName, email, role }));
  const submit = () =>
    create.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        setFullName('');
        setEmail('');
      },
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('admin.admins.create')}</Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('admin.admins.createTitle')}
        description={t('admin.admins.createHint')}
        submitLabel={t('admin.admins.create')}
        submitting={create.isPending}
        error={create.isError ? t('admin.admins.createFailed') : undefined}
        onSubmit={submit}
      >
        <TextField label={t('admin.columns.name')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label={t('admin.admins.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <SelectField
          label={t('admin.columns.role')}
          value={role}
          options={enumValues(AdminRole).map((value) => ({ value, label: display(EnumKey.AdminRole, value).label }))}
          onValueChange={(value) => setRole(value as AdminRole)}
        />
      </FormDialog>
    </>
  );
}
