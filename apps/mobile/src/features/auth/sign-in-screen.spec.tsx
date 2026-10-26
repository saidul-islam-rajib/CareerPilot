import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@careerpilot/client-core';
import { Text } from '@/ui';
import { renderWithProviders } from '@/test/render';
import { SignInScreen } from './sign-in-screen';

function SessionProbe() {
  const { status, user } = useSession();
  return <Text testID="session-probe">{`${status}:${user?.email ?? ''}`}</Text>;
}

async function renderSignIn() {
  return await renderWithProviders(
    <>
      <SignInScreen />
      <SessionProbe />
    </>,
    { signedIn: false },
  );
}

describe('SignInScreen', () => {
  it('shows validation messages for empty fields', async () => {
    await renderSignIn();
    await fireEvent.press(await screen.findByTestId('sign-in-submit'));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
  });

  it('shows an error for wrong credentials', async () => {
    await renderSignIn();
    await fireEvent.changeText(await screen.findByTestId('sign-in-email'), 'admin@sober.com');
    await fireEvent.changeText(screen.getByTestId('sign-in-password'), 'wrong-password');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  it('signs in with the local default account', async () => {
    await renderSignIn();
    await fireEvent.changeText(await screen.findByTestId('sign-in-email'), 'admin@sober.com');
    await fireEvent.changeText(screen.getByTestId('sign-in-password'), 'admin@sober.com');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    await waitFor(() => expect(screen.getByTestId('session-probe').props.children).toBe('signed_in:admin@sober.com'));
  });
});
