import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@careerpilot/client-core';
import { Text } from '@/ui';
import { mockRouter, renderWithProviders } from '@/test/render';
import { RegisterScreen } from './register-screen';

function SessionProbe() {
  const { status } = useSession();
  return <Text testID="session-probe">{status}</Text>;
}

async function fillForm(email: string) {
  await fireEvent.changeText(await screen.findByTestId('register-name'), 'New Person');
  await fireEvent.changeText(screen.getByTestId('register-email'), email);
}

describe('RegisterScreen', () => {
  it('asks for no password', async () => {
    await renderWithProviders(<RegisterScreen />, { signedIn: false });
    expect(await screen.findByTestId('register-name')).toBeTruthy();
    expect(screen.queryByTestId('register-password')).toBeNull();
  });

  it('requires the consent checkbox before sending the link', async () => {
    await renderWithProviders(<RegisterScreen />, { signedIn: false });
    await fillForm('new.person@example.com');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('You need to accept the Terms and Privacy Policy to continue.')).toBeTruthy();
  });

  it('emails a link, stays signed out, and offers a resend countdown', async () => {
    await renderWithProviders(
      <>
        <RegisterScreen />
        <SessionProbe />
      </>,
      { signedIn: false },
    );
    await fillForm('new.person@example.com');
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/We've sent a link to new\.person@example\.com/)).toBeTruthy();
    expect(screen.getByTestId('resend-link').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('session-probe').props.children).toBe('signed_out');
    expect(screen.queryByTestId('open-demo-link')).toBeNull();
  });

  it('answers the same way for an email that already has an account', async () => {
    await renderWithProviders(<RegisterScreen />, { signedIn: false });
    await fillForm('admin@sober.com');
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('Check your email')).toBeTruthy();
  });

  it('goes back to the form to use a different email', async () => {
    await renderWithProviders(<RegisterScreen />, { signedIn: false });
    await fillForm('typo@example.con');
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByTestId('register-submit'));
    await fireEvent.press(await screen.findByTestId('different-email'));
    await waitFor(() => expect(screen.getByTestId('register-name')).toBeTruthy());
  });
});
