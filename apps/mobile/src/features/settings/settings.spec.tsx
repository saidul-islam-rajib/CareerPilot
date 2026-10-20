import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApplicationMode, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { renderWithProviders } from '@/test/render';
import { AboutScreen } from './about-screen';
import { ActivityScreen } from './activity-screen';
import { DeleteAccountScreen } from './delete-account-screen';
import { LicencesScreen } from './licences-screen';
import { MoreScreen } from './more-screen';
import { PauseScreen } from './pause-screen';
import { TracksScreen } from './tracks-screen';
import { WindowScreen } from './window-screen';

describe('MoreScreen', () => {
  it('shows the theme chosen by admins and the Team Sober credit', async () => {
    renderWithProviders(<MoreScreen />);
    expect(await screen.findByText('Current theme: Sober')).toBeTruthy();
    expect(screen.getByText('Developed by Team Sober')).toBeTruthy();
  });
});

describe('TracksScreen', () => {
  it('changes the result count and application mode of a track', async () => {
    const { services } = renderWithProviders(<TracksScreen />);
    fireEvent.press((await screen.findAllByLabelText('Increase Matches shown per day'))[0]!);
    fireEvent.press(screen.getAllByRole('tab', { name: 'Apply automatically within my rules' })[0]!);
    await waitFor(async () => {
      const track = (await services.api.settings.getSettings()).tracks.find((t) => t.id === 'trk_remote');
      expect(track).toMatchObject({ resultCount: 6, mode: ApplicationMode.Automatic });
    });
  });
});

describe('PauseScreen', () => {
  it('pauses for seven days and resumes', async () => {
    renderWithProviders(<PauseScreen />);
    fireEvent.press(await screen.findByTestId('pause-confirm'));
    expect(await screen.findByText('Paused until Oct 27, 2026')).toBeTruthy();
    fireEvent.press(screen.getByTestId('resume'));
    await waitFor(() => expect(screen.queryByText('Automatic applications are paused')).toBeNull());
  });

  it('pauses until resumed', async () => {
    renderWithProviders(<PauseScreen />);
    fireEvent.press(await screen.findByRole('tab', { name: 'Until I resume' }));
    fireEvent.press(screen.getByTestId('pause-confirm'));
    expect(await screen.findByText('Paused until you resume')).toBeTruthy();
  });
});

describe('WindowScreen', () => {
  it('validates and saves a daily midnight window', async () => {
    const { services } = renderWithProviders(<WindowScreen />);
    fireEvent.changeText(await screen.findByTestId('window-start'), '25:00');
    fireEvent.press(screen.getByTestId('window-save'));
    expect(await screen.findByText('Enter a time as HH:MM.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('window-start'), '23:30');
    fireEvent.press(screen.getByTestId('window-save'));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect((await services.api.settings.getSettings()).submissionWindow).toEqual({ kind: SubmissionWindowKind.DailyWindow, start: '23:30', end: '01:00' });
  });
});

describe('ActivityScreen', () => {
  it('lists sign-ins with IP, location, and failed attempts', async () => {
    renderWithProviders(<ActivityScreen />);
    expect(await screen.findByText('This device')).toBeTruthy();
    expect(screen.getByText('Failed attempt')).toBeTruthy();
    expect(screen.getByText(/Singapore · 45.120.8.10/)).toBeTruthy();
  });
});

describe('DeleteAccountScreen', () => {
  it('requires typing DELETE and schedules deletion after the grace period', async () => {
    renderWithProviders(<DeleteAccountScreen />);
    const button = await screen.findByTestId('delete-confirm');
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('delete-confirm-input'), 'DELETE');
    fireEvent.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByText('Account deletion scheduled for Nov 3, 2026.')).toBeTruthy();
  });
});

describe('About and licences', () => {
  it('credits Team Sober and lists open-source licences', async () => {
    renderWithProviders(<AboutScreen />);
    expect(await screen.findByText('Developed by Team Sober')).toBeTruthy();
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
    renderWithProviders(<LicencesScreen />);
    expect(await screen.findByText('React Native Reusables')).toBeTruthy();
  });
});
