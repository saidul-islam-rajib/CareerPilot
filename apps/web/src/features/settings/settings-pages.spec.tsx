import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationMode, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { renderWithProviders } from '@/test/render';
import { AboutPage } from './about-page';
import { ActivityPage } from './activity-page';
import { AnswersPage } from './answers-page';
import { DeleteAccountPage } from './delete-account-page';
import { LicencesPage } from './licences-page';
import { NotificationsPage } from './notifications-page';
import { PasswordPage } from './password-page';
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
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveAttribute('href', '/settings/notifications');
    expect(screen.getByRole('link', { name: /Change password/ })).toHaveAttribute('href', '/settings/password');
  });
});

describe('NotificationsPage', () => {
  it('picks a preset or a custom time, saves only real changes, and turns the digest off', async () => {
    const { services } = renderWithProviders(<NotificationsPage />);
    const time = await screen.findByLabelText('Or choose a time');
    await waitFor(() => expect(time).toHaveValue('08:00'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Morning/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Evening/ }));
    expect(time).toHaveValue('18:00');
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    fireEvent.change(time, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a time as HH:MM.')).toBeInTheDocument();
    fireEvent.change(time, { target: { value: '07:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect((await services.api.settings.getSettings()).notifications).toEqual({ digestEnabled: true, digestTime: '07:30' });
    fireEvent.click(screen.getByRole('switch', { name: 'Daily digest email' }));
    expect(screen.getByText(/The daily email is off/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).notifications.digestEnabled).toBe(false));
  });

  it('shows where the digest goes and what it contains', async () => {
    renderWithProviders(<NotificationsPage />);
    expect(await screen.findByText('admin@sober.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change in profile' })).toHaveAttribute('href', '/profile#profile-contacts');
    expect(screen.getByRole('heading', { name: "What's in your digest" })).toBeInTheDocument();
    expect(screen.getByText('Waiting for your approval')).toBeInTheDocument();
  });
});

describe('PasswordPage', () => {
  it('reports a wrong current password and then changes it', async () => {
    renderWithProviders(<PasswordPage />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'not-my-password' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'N3w!Password99' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'N3w!Password99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'admin@sober.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your password has been changed.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('checks the new password before sending it', async () => {
    renderWithProviders(<PasswordPage />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
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

  it('shows each click at once, saves the final count, and accepts a typed number', async () => {
    const { services } = renderWithProviders(<TracksPage />);
    const increase = (await screen.findAllByRole('button', { name: 'Increase Matches shown per day' }))[0]!;
    fireEvent.click(increase);
    fireEvent.click(increase);
    fireEvent.click(increase);
    const count = screen.getAllByRole('spinbutton')[0]!;
    expect(count).toHaveValue(8);
    await waitFor(async () => expect((await services.api.settings.getSettings()).tracks.find((t) => t.id === 'trk_remote')?.resultCount).toBe(8));
    fireEvent.change(count, { target: { value: '25' } });
    await waitFor(async () => expect((await services.api.settings.getSettings()).tracks.find((t) => t.id === 'trk_remote')?.resultCount).toBe(25));
    fireEvent.change(count, { target: { value: '999' } });
    fireEvent.blur(count);
    expect(count).toHaveValue(25);
  });
});

describe('PausePage', () => {
  it('shows the running state, pauses until the date shown on each choice, and resumes', async () => {
    renderWithProviders(<PausePage />);
    expect(await screen.findByText('Applications are running')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Until Oct 27, 2026/ })).toBeChecked();
    expect(screen.getByText('No applications are sent, including ones you already approved.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause until Oct 27, 2026' }));
    expect(await screen.findByText('Paused until Oct 27, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText('Applications are running')).toBeInTheDocument();
  });

  it('offers pausing with no end date', async () => {
    renderWithProviders(<PausePage />);
    fireEvent.click(await screen.findByRole('radio', { name: /No end date/ }));
    expect(screen.getByRole('button', { name: 'Pause until I resume' })).toBeInTheDocument();
  });
});

describe('WindowPage', () => {
  it('fills a daily window from a quick choice, explains it, and saves only real changes', async () => {
    const { services } = renderWithProviders(<WindowPage />);
    const midnight = await screen.findByLabelText('From');
    expect(midnight).toHaveValue('00:00');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Evening/ }));
    expect(screen.getByLabelText('From')).toHaveValue('18:00');
    expect(screen.getByLabelText('To')).toHaveValue('22:00');
    expect(screen.getByText(/Applications go out every day between 18:00 and 22:00/)).toBeInTheDocument();
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Enter a time as HH:MM|This field is required/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '19:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect((await services.api.settings.getSettings()).submissionWindow).toEqual({ kind: SubmissionWindowKind.DailyWindow, start: '19:30', end: '22:00' });
  });

  it('switches to sending as soon as applications are ready', async () => {
    const { services } = renderWithProviders(<WindowPage />);
    fireEvent.click(await screen.findByRole('radio', { name: /As soon as ready/ }));
    expect(screen.getByText("Applications go out as soon as they're approved.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).submissionWindow.kind).toBe(SubmissionWindowKind.AsSoonAsReady));
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

describe('AnswersPage', () => {
  it('shows blocking questions first and answering one unblocks the approval', async () => {
    const user = userEvent.setup();
    const { services } = renderWithProviders(<AnswersPage />);
    const blocking = await screen.findByRole('region', { name: 'Needs an answer' });
    expect(within(blocking).getByText('Are you willing to relocate to Oslo?')).toBeInTheDocument();
    await user.click(within(blocking).getByRole('button', { name: 'Save this answer: Are you willing to relocate to Oslo?' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add answer' });
    expect(within(dialog).getByLabelText('Topic')).toHaveValue('relocation');
    await user.type(within(dialog).getByLabelText('Answer'), 'Yes, within Europe');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Answer saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Needs an answer' })).not.toBeInTheDocument());
    const oslo = await services.api.approvals.getApproval('apr_oslo');
    expect(oslo.materials.answers.find((a) => a.id === 'q_relocate')).toMatchObject({ answer: 'Yes, within Europe', source: 'saved' });
  });

  it('groups questions, adds a new answer with a suggested question, and removes with undo', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnswersPage />);
    const asked = await screen.findByRole('region', { name: "Questions you've been asked" });
    expect(within(asked).getByText('Asked 5 times')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add answer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add answer' });
    await user.selectOptions(within(dialog).getByLabelText('Topic'), 'salary_expectation');
    expect(within(dialog).getByLabelText('Question')).toHaveValue('What are your salary expectations?');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Answer'), 'USD 80,000 per year');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    const saved = await screen.findByRole('region', { name: 'Your saved answers' });
    expect(await within(saved).findByText('USD 80,000 per year')).toBeInTheDocument();
    await user.click(within(saved).getByRole('button', { name: 'More actions for What are your salary expectations?' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(await screen.findByText('Answer removed')).toBeInTheDocument();
    await waitFor(() => expect(within(saved).queryByText('USD 80,000 per year')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await within(saved).findByText('USD 80,000 per year')).toBeInTheDocument();
  });
});
