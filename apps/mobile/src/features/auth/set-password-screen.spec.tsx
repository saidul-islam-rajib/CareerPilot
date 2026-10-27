import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@careerpilot/client-core';
import { TEST_LINK_TOKEN } from '@careerpilot/client-core/src/testing';
import { Text } from '@/ui';
import { createTestServices, mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { SetPasswordScreen } from './set-password-screen';

const EMAILED_LINK = { token: TEST_LINK_TOKEN };
const REGISTRATION = { fullName: 'New Person', email: 'new.person@example.com', consent: true, consentDocuments: { terms: '1.0', privacy: '1.0' } };

function SessionProbe() {
  const { status } = useSession();
  return <Text testID="session-probe">{status}</Text>;
}

describe('SetPasswordScreen', () => {
  it('explains a link without a token and offers a new one', async () => {
    await renderWithProviders(<SetPasswordScreen />, { signedIn: false });
    expect(await screen.findByText('This link is incomplete. Open it again from your email.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('request-new-link'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/forgot-password');
  });

  it('explains a link that is not valid', async () => {
    mockParams.current = { token: 'wrong' };
    await renderWithProviders(<SetPasswordScreen />, { signedIn: false });
    expect(await screen.findByText(/This link isn't valid/)).toBeTruthy();
  });

  it('finishes registration with a confirmed password and signs in', async () => {
    const services = createTestServices(false);
    await services.api.auth.register(REGISTRATION);
    mockParams.current = EMAILED_LINK;
    await renderWithProviders(
      <>
        <SetPasswordScreen />
        <SessionProbe />
      </>,
      { services },
    );
    expect(await screen.findByText('Hi New Person, choose a password to finish creating your account.')).toBeTruthy();
    expect(screen.getByText('new.person@example.com')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('new-password'), 'Str0ng!Password');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'Other!Password1');
    await fireEvent.press(screen.getByTestId('set-password-submit'));
    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'Str0ng!Password');
    await fireEvent.press(screen.getByTestId('set-password-submit'));
    await waitFor(() => expect(screen.getByTestId('session-probe').props.children).toBe('signed_in'));
  });

  it('labels a password reset link', async () => {
    const services = createTestServices(false);
    await services.api.auth.requestPasswordReset('admin@sober.com');
    mockParams.current = EMAILED_LINK;
    await renderWithProviders(<SetPasswordScreen />, { services });
    expect(await screen.findByText(/choose a new password/)).toBeTruthy();
    expect(screen.getByTestId('set-password-submit').props.accessibilityLabel).toBe('Save new password');
  });
});
