import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useAdminSession } from '@/core/admin-session';
import { AdminRoutes } from '@/core/routes';
import { navigation, renderAdmin, testConfig } from '@/test/render';
import { ForgotPasswordPage } from './forgot-password-page';
import { SetPasswordPage } from './set-password-page';
import { SignInPage } from './sign-in-page';

const ADMIN_EMAIL = 'admin@sober.com';
const NEW_PASSWORD = 'Str0ng!Password';
const linkToken = () => testConfig().api.demoLinkToken;

function SessionProbe() {
  const { status, admin } = useAdminSession();
  return <output data-testid="session">{`${status}:${admin?.email ?? ''}`}</output>;
}

describe('admin password links', () => {
  it('offers a password link from the sign-in page', async () => {
    await renderAdmin(<SignInPage />, { signedIn: false });
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', AdminRoutes.forgotPassword);
  });

  it('asks for a link and answers the same way for any address', async () => {
    await renderAdmin(<ForgotPasswordPage />, { signedIn: false });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
    expect(await screen.findByText(/If nobody@example\.com belongs to an admin account, a link is on its way\. It expires in 5 minutes\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', AdminRoutes.signIn);
  });

  it('sets the password from a valid link and signs the admin in', async () => {
    await renderAdmin(
      <>
        <SetPasswordPage />
        <SessionProbe />
      </>,
      { signedIn: false, search: `token=${linkToken()}`, prepare: (services) => services.api.auth.requestPasswordLink({ email: ADMIN_EMAIL }) },
    );
    expect(await screen.findByText(ADMIN_EMAIL)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: NEW_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different!Pass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password and sign in' }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: NEW_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password and sign in' }));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent(`signed_in:${ADMIN_EMAIL}`));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(AdminRoutes.dashboard));
  });

  it('explains links that are missing or no longer valid', async () => {
    await renderAdmin(<SetPasswordPage />, { signedIn: false, search: `token=${linkToken()}` });
    expect(await screen.findByText("This link can't be used")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute('href', AdminRoutes.forgotPassword);
  });
});
