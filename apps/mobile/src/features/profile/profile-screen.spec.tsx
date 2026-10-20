import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { ProfileScreen } from './profile-screen';
import { ViewerScreen } from './viewer-screen';

describe('ProfileScreen', () => {
  it('shows the master profile', async () => {
    renderWithProviders(<ProfileScreen />);
    expect(await screen.findByText('Ayesha Rahman')).toBeTruthy();
    expect(screen.getByText('Profile 86% complete')).toBeTruthy();
    expect(screen.getByText('BSc in Computer Science and Engineering')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('reorders contacts with the accessible move buttons', async () => {
    const { services } = renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Move down: admin@sober.com'));
    await waitFor(async () => {
      const profile = await services.api.profile.getProfile();
      expect([...profile.contacts].sort((a, b) => a.position - b.position).map((c) => c.id).slice(0, 2)).toEqual(['c_phone_mobile', 'c_email_work']);
    });
  });

  it('makes another email primary', async () => {
    const { services } = renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Make primary: ayesha.personal@example.com'));
    await waitFor(async () => {
      const profile = await services.api.profile.getProfile();
      expect(profile.contacts.find((c) => c.isPrimary && c.kind === 'email')?.id).toBe('c_email_personal');
    });
  });

  it('opens the photo viewer', async () => {
    renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Photo. Tap to view and zoom'));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/viewer' }));
  });
});

describe('ViewerScreen', () => {
  it('offers zoom controls and closes', async () => {
    mockParams.current = { uri: 'data:image/png;base64,AAAA', title: 'Signature' };
    renderWithProviders(<ViewerScreen />);
    expect(await screen.findByLabelText('Zoom in')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Zoom in'));
    fireEvent.press(screen.getByLabelText('Reset zoom'));
    fireEvent.press(screen.getByLabelText('Close'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
