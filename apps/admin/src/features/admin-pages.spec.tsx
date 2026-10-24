import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { EmergencyStopScope, SourceStatus, UserAccountStatus } from '@careerpilot/domain-ui-logic';
import { ThemeKey } from '@careerpilot/ui-tokens';
import { useAdminSession } from '@/core/admin-session';
import { renderAdmin } from '@/test/render';
import { AdminsPage } from './admins/admins-page';
import { SignInPage } from './auth/sign-in-page';
import { AuditPage, SourcesPage } from './catalog/catalog-pages';
import { DashboardPage } from './dashboard/dashboard-page';
import { SettingsPage } from './settings/settings-page';
import { AdminShell } from './shell/admin-shell';
import { UserPage } from './users/user-page';
import { UsersPage } from './users/users-page';

function SessionProbe() {
  const { status, admin } = useAdminSession();
  return <output data-testid="session">{`${status}:${admin?.role ?? ''}`}</output>;
}

describe('SignInPage', () => {
  it('rejects wrong credentials and signs in the super admin', async () => {
    await renderAdmin(
      <>
        <SignInPage />
        <SessionProbe />
      </>,
      { signedIn: false },
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@sober.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin@sober.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signed_in:super_admin'));
  });
});

describe('AdminShell', () => {
  it('shows only the areas a role can read', async () => {
    await renderAdmin(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
      { email: 'support@sober.com' },
    );
    const nav = (await screen.findAllByRole('navigation'))[0]!;
    await waitFor(() => expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument());
    expect(within(nav).queryByRole('link', { name: 'Platform settings' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Admins and roles' })).not.toBeInTheDocument();
  });
});

describe('DashboardPage', () => {
  it('shows computed metrics, the chart, and system health', async () => {
    await renderAdmin(<DashboardPage />);
    expect(await screen.findByText('Total users')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Applications per day' })).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });
});

describe('Users', () => {
  it('searches and filters the user list', async () => {
    await renderAdmin(<UsersPage />);
    expect(await screen.findByText('Ayesha Rahman')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'nusrat' } });
    await waitFor(() => expect(screen.queryByText('Ayesha Rahman')).not.toBeInTheDocument());
    expect(screen.getByText('Nusrat Akter')).toBeInTheDocument();
  });

  it('shows secrets as metadata only and suspends after confirmation', async () => {
    const { services } = await renderAdmin(<UserPage />, { params: { id: 'usr_002' } });
    expect(await screen.findByText(/Secret values are never shown/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    await waitFor(async () => expect((await services.api.users.getUser('usr_002')).status).toBe(UserAccountStatus.Suspended));
    const audit = await services.api.audit.listAudit({ page: 1, pageSize: 5 });
    expect(audit.items.some((e) => e.action === 'user.suspended')).toBe(true);
  });

  it('hides actions from read-only admins', async () => {
    await renderAdmin(<UserPage />, { params: { id: 'usr_002' }, email: 'viewer@sober.com' });
    expect(await screen.findByText('Tanvir Hossain')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
  });
});

describe('SourcesPage', () => {
  it('disables a source', async () => {
    const { services } = await renderAdmin(<SourcesPage />);
    const row = (await screen.findByText('University admissions pages')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Disable' }));
    await waitFor(async () => {
      const sources = await services.api.sources.listSources({ page: 1, pageSize: 20 });
      expect(sources.items.find((s) => s.id === 'src_university')?.status).toBe(SourceStatus.Disabled);
    });
  });
});

describe('SettingsPage', () => {
  it('previews and applies a theme for all users', async () => {
    const { services } = await renderAdmin(<SettingsPage />);
    fireEvent.click(await screen.findByRole('radio', { name: /Orchid/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Orchid' }));
    expect(await screen.findByText('Orchid is now active for all users.')).toBeInTheDocument();
    expect((await services.api.settings.getSettings()).activeTheme).toBe(ThemeKey.Orchid);
  });

  it('requires a reason and confirmation for the emergency stop', async () => {
    const { services } = await renderAdmin(<SettingsPage />);
    const stop = await screen.findByRole('button', { name: 'Stop all automation' });
    expect(stop).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Portal incident' } });
    fireEvent.click(stop);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Stop all automation' }));
    expect(await screen.findByText(/Emergency stop active since .*: Portal incident/)).toBeInTheDocument();
    expect((await services.api.settings.getSettings()).emergencyStop).toMatchObject({ active: true, scope: EmergencyStopScope.AllUsers });
    fireEvent.click(screen.getByRole('button', { name: 'Resume automation' }));
    await waitFor(() => expect(screen.queryByText(/Emergency stop active/)).not.toBeInTheDocument());
  });
});

describe('Audit and admins', () => {
  it('lists audit entries', async () => {
    await renderAdmin(<AuditPage />);
    expect(await screen.findByText('admin.signed_in')).toBeInTheDocument();
  });

  it('changes another admin role but not their own', async () => {
    const { services } = await renderAdmin(<AdminsPage />);
    const select = await screen.findByLabelText('Role: Read-only Viewer');
    fireEvent.change(select, { target: { value: 'support' } });
    await waitFor(async () => expect((await services.api.admins.listAdmins()).find((a) => a.id === 'adm_viewer')?.role).toBe('support'));
    expect(screen.queryByLabelText('Role: Super Admin')).not.toBeInTheDocument();
  });
});
