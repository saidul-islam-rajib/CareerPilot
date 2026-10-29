import { fireEvent, screen } from '@testing-library/react-native';
import { mockRouter, renderWithProviders } from '@/test/render';
import { WelcomeScreen } from './welcome-screen';

describe('WelcomeScreen', () => {
  it('tells the story and leads to sign up and sign in', async () => {
    await renderWithProviders(<WelcomeScreen />, { signedIn: false });
    expect(await screen.findByText('What makes CareerPilot different')).toBeTruthy();
    expect(screen.getByText('What CareerPilot will never do')).toBeTruthy();
    expect(screen.getByLabelText(/preview of the Today screen/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('welcome-create-account'));
    expect(mockRouter.push).toHaveBeenCalledWith('/register');
    await fireEvent.press(screen.getByTestId('welcome-sign-in'));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });
});

describe('WelcomeScreen heading', () => {
  it('has one heading for the title, with the accent words inside it', async () => {
    await renderWithProviders(<WelcomeScreen />, { signedIn: false });
    const title = await screen.findByRole('header', { name: /Your career, on autopilot\./ });
    expect(title).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'on autopilot.' })).toBeNull();
  });
});
