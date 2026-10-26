import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useSession } from '@careerpilot/client-core';
import { createSignedOutServices, navigation, renderWithProviders } from '@/test/render';
import { ForgotPasswordPage } from './forgot-password-page';
import { RegisterPage } from './register-page';
import { SetPasswordPage } from './set-password-page';
import { SignInPage } from './sign-in-page';
import { WelcomePage } from './welcome-page';

const DEMO_LINK = '?token=demo-link';

function SessionProbe() {
  const { status } = useSession();
  return <output data-testid="session">{status}</output>;
}

function fillRegistration(email: string) {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Person' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
}

function choosePassword(password: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirmation } });
}

describe('WelcomePage', () => {
  it('offers sign up, sign in, and the Team Sober credit', () => {
    renderWithProviders(<WelcomePage />, { signedIn: false });
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /Developed by Team Sober/ })).toHaveAttribute('href', 'https://team-sober.com/');
  });
});

describe('SignInPage', () => {
  it('validates and rejects wrong credentials', async () => {
    renderWithProviders(<SignInPage />, { signedIn: false });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@sober.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
  });

  it('signs in with the local default account', async () => {
    renderWithProviders(
      <>
        <SignInPage />
        <SessionProbe />
      </>,
      { signedIn: false },
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@sober.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin@sober.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signed_in'));
  });
});

describe('RegisterPage', () => {
  it('requires consent before creating an account', async () => {
    renderWithProviders(<RegisterPage />, { signedIn: false });
    fillRegistration('new@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('You need to accept the Terms and Privacy Policy to continue.')).toBeInTheDocument();
  });

  it('asks for no password and emails a link after consent', async () => {
    navigation.push.mockClear();
    renderWithProviders(
      <>
        <RegisterPage />
        <SessionProbe />
      </>,
      { signedIn: false },
    );
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fillRegistration('new@example.com');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/We've sent a link to new@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/expires in 60 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send a new link in \d+s/ })).toBeDisabled();
    expect(screen.getByTestId('session')).toHaveTextContent('signed_out');
    fireEvent.click(screen.getByRole('button', { name: 'Open the link' }));
    expect(navigation.push).toHaveBeenCalledWith('/set-password?token=demo-link');
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('links the Terms and Privacy Policy from configuration', () => {
    renderWithProviders(<RegisterPage />, { signedIn: false });
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', 'https://team-sober.com/careerpilot/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://team-sober.com/careerpilot/privacy');
  });
});

describe('SetPasswordPage', () => {
  it('explains a link without a token', () => {
    renderWithProviders(<SetPasswordPage />, { signedIn: false });
    expect(screen.getByText('This link is incomplete. Open it again from your email.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('explains a link that is not valid', async () => {
    renderWithProviders(<SetPasswordPage />, { signedIn: false, search: '?token=wrong' });
    expect(await screen.findByText(/This link isn't valid/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('finishes registration with a confirmed password and signs in', async () => {
    navigation.replace.mockClear();
    const services = createSignedOutServices();
    await services.api.auth.register({ fullName: 'New Person', email: 'new@example.com', consent: true, consentDocuments: { terms: '1.0', privacy: '1.0' } });
    renderWithProviders(
      <>
        <SetPasswordPage />
        <SessionProbe />
      </>,
      { signedIn: false, search: DEMO_LINK, services },
    );
    expect(await screen.findByRole('heading', { name: 'Choose your password' })).toBeInTheDocument();
    expect(screen.getByText('Hi New Person, choose a password to finish creating your account.')).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    choosePassword('Str0ng!Password', 'Other!Password1');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    choosePassword('Str0ng!Password', 'Str0ng!Password');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signed_in'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
  });

  it('resets the password of an existing account', async () => {
    const services = createSignedOutServices();
    await services.api.auth.requestPasswordReset('admin@sober.com');
    renderWithProviders(<SetPasswordPage />, { signedIn: false, search: DEMO_LINK, services });
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save new password' })).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage', () => {
  it('confirms that a reset link was sent', async () => {
    renderWithProviders(<ForgotPasswordPage />, { signedIn: false });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@sober.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/we've sent a link to reset your password/)).toBeInTheDocument();
  });
});
