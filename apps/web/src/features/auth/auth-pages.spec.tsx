import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useSession } from '@careerpilot/client-core';
import { renderWithProviders } from '@/test/render';
import { ForgotPasswordPage } from './forgot-password-page';
import { RegisterPage } from './register-page';
import { SignInPage } from './sign-in-page';
import { WelcomePage } from './welcome-page';

function SessionProbe() {
  const { status } = useSession();
  return <output data-testid="session">{status}</output>;
}

function fillRegistration(email: string) {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Person' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Password' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ng!Password' } });
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

  it('creates an account after consent', async () => {
    renderWithProviders(
      <>
        <RegisterPage />
        <SessionProbe />
      </>,
      { signedIn: false },
    );
    fillRegistration('new@example.com');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('signed_in'));
  });

  it('links the Terms and Privacy Policy from configuration', () => {
    renderWithProviders(<RegisterPage />, { signedIn: false });
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', 'https://team-sober.com/careerpilot/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://team-sober.com/careerpilot/privacy');
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
