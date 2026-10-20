import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@careerpilot/client-core';
import { Text } from '@/ui';
import { renderWithProviders } from '@/test/render';
import { RegisterScreen } from './register-screen';

function SessionProbe() {
  const { status } = useSession();
  return <Text testID="session-probe">{status}</Text>;
}

async function fillForm(email: string) {
  fireEvent.changeText(await screen.findByTestId('register-name'), 'New Person');
  fireEvent.changeText(screen.getByTestId('register-email'), email);
  fireEvent.changeText(screen.getByTestId('register-password'), 'Str0ng!Password');
  fireEvent.changeText(screen.getByTestId('register-confirm'), 'Str0ng!Password');
}

describe('RegisterScreen', () => {
  it('requires the consent checkbox before creating an account', async () => {
    renderWithProviders(<RegisterScreen />, { signedIn: false });
    await fillForm('new.person@example.com');
    fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('You need to accept the Terms and Privacy Policy to continue.')).toBeTruthy();
  });

  it('creates an account after consent and signs in', async () => {
    renderWithProviders(
      <>
        <RegisterScreen />
        <SessionProbe />
      </>,
      { signedIn: false },
    );
    await fillForm('new.person@example.com');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByTestId('register-submit'));
    await waitFor(() => expect(screen.getByTestId('session-probe').props.children).toBe('signed_in'));
  });

  it('reports an email that is already registered', async () => {
    renderWithProviders(<RegisterScreen />, { signedIn: false });
    await fillForm('admin@sober.com');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
  });

  it('rejects mismatched passwords', async () => {
    renderWithProviders(<RegisterScreen />, { signedIn: false });
    await fillForm('x@example.com');
    fireEvent.changeText(screen.getByTestId('register-confirm'), 'Different!Pass1');
    fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
  });
});
