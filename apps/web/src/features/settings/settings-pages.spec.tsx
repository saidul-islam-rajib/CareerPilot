import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ApplicationMode, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { renderWithProviders } from '@/test/render';
import { AboutPage } from './about-page';
import { ActivityPage } from './activity-page';
import { DeleteAccountPage } from './delete-account-page';
import { LicencesPage } from './licences-page';
import { PausePage } from './pause-page';
import { SettingsPage } from './settings-page';
import { TracksPage } from './tracks-page';
import { WindowPage } from './window-page';

describe('SettingsPage', () => {
  it('shows the admin-selected theme and links to every setting', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Current theme: Sober')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pause applications/ })).toHaveAttribute('href', '/settings/pause');
    expect(screen.getByRole('link', { name: /Delete account/ })).toHaveAttribute('href', '/settings/delete-account');
  });
});

describe('TracksPage', () => {
  it('changes result count and mode', async () => {
    const { services } = renderWithProviders(<TracksPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Increase Matches shown per day' }))[0]!);
    fireEvent.click(screen.getAllByRole('radio', { name: 'Apply automatically within my rules' })[0]!);
    await waitFor(async () => {
      const track = (await services.api.settings.getSettings()).tracks.find((t) => t.id === 'trk_remote');
      expect(track).toMatchObject({ resultCount: 6, mode: ApplicationMode.Automatic });
    });
  });
});

describe('PausePage', () => {
  it('pauses for seven days and resumes', async () => {
    renderWithProviders(<PausePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pause now' }));
    expect(await screen.findByText('Paused until Oct 27, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(screen.queryByText('Automatic applications are paused')).not.toBeInTheDocument());
  });
});

describe('WindowPage', () => {
  it('validates and saves a midnight window', async () => {
    const { services } = renderWithProviders(<WindowPage />);
    fireEvent.change(await screen.findByLabelText('From'), { target: { value: '25:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a time as HH:MM.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '23:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect((await services.api.settings.getSettings()).submissionWindow).toEqual({ kind: SubmissionWindowKind.DailyWindow, start: '23:30', end: '01:00' });
  });
});

describe('ActivityPage', () => {
  it('lists sign-ins with IP and approximate location', async () => {
    renderWithProviders(<ActivityPage />);
    expect(await screen.findByText('Failed attempt')).toBeInTheDocument();
    expect(screen.getByText(/Singapore · 45.120.8.10/)).toBeInTheDocument();
  });
});

describe('DeleteAccountPage', () => {
  it('requires the keyword and schedules deletion', async () => {
    renderWithProviders(<DeleteAccountPage />);
    const button = screen.getByRole('button', { name: 'Delete account' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(button);
    expect(await screen.findByText('Account deletion scheduled for Nov 3, 2026.')).toBeInTheDocument();
  });
});

describe('About and licences', () => {
  it('credits Team Sober and lists licences', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getAllByText('Developed by Team Sober').length).toBeGreaterThan(0);
    renderWithProviders(<LicencesPage />);
    expect(screen.getByRole('link', { name: /React Native Reusables/ })).toHaveAttribute('href', 'https://github.com/founded-labs/react-native-reusables');
  });
});
