import { fireEvent, screen } from '@testing-library/react-native';
import { mockRouter, renderWithProviders } from '@/test/render';
import { ForgotPasswordScreen } from './forgot-password-screen';

describe('ForgotPasswordScreen', () => {
  it('sends the reset link and leads back to sign in', async () => {
    await renderWithProviders(<ForgotPasswordScreen />, { signedIn: false });
    await fireEvent.changeText(await screen.findByTestId('reset-email'), 'admin@sober.com');
    await fireEvent.press(screen.getByTestId('reset-submit'));
    expect(await screen.findByText(/we've sent a link to reset your password/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reset-back-to-sign-in'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });
});
