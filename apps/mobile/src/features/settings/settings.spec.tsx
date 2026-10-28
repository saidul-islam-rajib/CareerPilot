import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApplicationMode, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { AboutScreen } from './about-screen';
import { ActivityScreen } from './activity-screen';
import { AnswerScreen, AnswersScreen } from './answers-screens';
import { DeleteAccountScreen } from './delete-account-screen';
import { LicencesScreen } from './licences-screen';
import { MoreScreen } from './more-screen';
import { NotificationsScreen } from './notifications-screen';
import { PasswordScreen } from './password-screen';
import { PauseScreen } from './pause-screen';
import { TracksScreen } from './tracks-screen';
import { WindowScreen } from './window-screen';

describe('MoreScreen', () => {
  it('shows the theme chosen by admins and the Team Sober credit', async () => {
    await renderWithProviders(<MoreScreen />);
    expect(await screen.findByText('Current theme: Sober')).toBeTruthy();
    expect(screen.getByText('Developed by Team Sober')).toBeTruthy();
  });
});

describe('TracksScreen', () => {
  it('changes the result count and application mode of a track', async () => {
    const { services } = await renderWithProviders(<TracksScreen />);
    await fireEvent.press((await screen.findAllByLabelText('Increase Matches shown per day'))[0]!);
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Apply automatically within my rules' })[0]!);
    await waitFor(async () => {
      const track = (await services.api.settings.getSettings()).tracks.find((t) => t.id === 'trk_remote');
      expect(track).toMatchObject({ resultCount: 6, mode: ApplicationMode.Automatic });
    });
  });

  it('shows each tap at once and accepts a typed number', async () => {
    const { services } = await renderWithProviders(<TracksScreen />);
    const increase = (await screen.findAllByLabelText('Increase Matches shown per day'))[0]!;
    await fireEvent.press(increase);
    await fireEvent.press(increase);
    expect(screen.getAllByLabelText('Matches shown per day: 7')[0]).toBeTruthy();
    await fireEvent.changeText(screen.getAllByLabelText('Matches shown per day: 7')[0]!, '20');
    await waitFor(async () => expect((await services.api.settings.getSettings()).tracks.find((t) => t.id === 'trk_remote')?.resultCount).toBe(20));
  });
});

describe('PauseScreen', () => {
  it('pauses for seven days and resumes', async () => {
    await renderWithProviders(<PauseScreen />);
    expect(await screen.findByText('Applications are running')).toBeTruthy();
    expect(screen.getByText('Pause until Oct 27, 2026')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pause-confirm'));
    expect(await screen.findByText('Paused until Oct 27, 2026')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('resume'));
    await waitFor(() => expect(screen.queryByText('Automatic applications are paused')).toBeNull());
  });

  it('pauses until resumed', async () => {
    await renderWithProviders(<PauseScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Until I resume' }));
    await fireEvent.press(screen.getByTestId('pause-confirm'));
    expect(await screen.findByText('Paused until you resume')).toBeTruthy();
  });
});

describe('WindowScreen', () => {
  it('fills hours from a quick choice and explains when applications go out', async () => {
    const { services } = await renderWithProviders(<WindowScreen />);
    await fireEvent.press(await screen.findByTestId('window-preset-evening'));
    expect(screen.getByText(/Applications go out every day between 18:00 and 22:00/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('window-save'));
    await waitFor(async () => expect((await services.api.settings.getSettings()).submissionWindow).toEqual({ kind: SubmissionWindowKind.DailyWindow, start: '18:00', end: '22:00' }));
  });

  it('validates and saves a daily midnight window', async () => {
    const { services } = await renderWithProviders(<WindowScreen />);
    await fireEvent.changeText(await screen.findByTestId('window-start'), '25:00');
    await fireEvent.press(screen.getByTestId('window-save'));
    expect(await screen.findByText('Enter a time as HH:MM.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('window-start'), '23:30');
    await fireEvent.press(screen.getByTestId('window-save'));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect((await services.api.settings.getSettings()).submissionWindow).toEqual({ kind: SubmissionWindowKind.DailyWindow, start: '23:30', end: '01:00' });
  });
});

describe('ActivityScreen', () => {
  it('lists sign-ins with IP, location, and failed attempts', async () => {
    await renderWithProviders(<ActivityScreen />);
    expect(await screen.findByText('This device')).toBeTruthy();
    expect(screen.getByText('Failed attempt')).toBeTruthy();
    expect(screen.getByText(/Singapore · 45.120.8.10/)).toBeTruthy();
  });
});

describe('DeleteAccountScreen', () => {
  it('requires typing DELETE and schedules deletion after the grace period', async () => {
    await renderWithProviders(<DeleteAccountScreen />);
    const button = await screen.findByTestId('delete-confirm');
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('delete-confirm-input'), 'DELETE');
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByText('Account deletion scheduled for Nov 3, 2026.')).toBeTruthy();
  });
});

describe('About and licences', () => {
  it('credits Team Sober and lists open-source licences', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(await screen.findByText('Developed by Team Sober')).toBeTruthy();
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
    await renderWithProviders(<LicencesScreen />);
    expect(await screen.findByText('React Native Reusables')).toBeTruthy();
  });
});

describe('NotificationsScreen', () => {
  it('picks a preset or a custom time and turns the digest off', async () => {
    const { services } = await renderWithProviders(<NotificationsScreen />);
    const time = await screen.findByTestId('digest-time');
    await waitFor(() => expect(time.props.value).toBe('08:00'));
    expect(screen.getByRole('radio', { name: 'Morning, 8:00 AM' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Evening, 6:00 PM' }));
    expect(screen.getByTestId('digest-time').props.value).toBe('18:00');
    expect(screen.getByText('You have unsaved changes.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('digest-time'), '7pm');
    await fireEvent.press(screen.getByTestId('notifications-save'));
    expect(await screen.findByText('Enter a time as HH:MM.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('digest-time'), '07:30');
    await fireEvent(screen.getByTestId('digest-enabled'), 'valueChange', false);
    expect(screen.getByText(/The daily email is off/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('notifications-save'));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect((await services.api.settings.getSettings()).notifications).toEqual({ digestEnabled: false, digestTime: '07:30' });
  });
});

describe('PasswordScreen', () => {
  it('reports a wrong current password and then changes it', async () => {
    await renderWithProviders(<PasswordScreen />);
    await fireEvent.changeText(screen.getByTestId('current-password'), 'not-my-password');
    await fireEvent.changeText(screen.getByTestId('new-password'), 'N3w!Password99');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'N3w!Password99');
    await fireEvent.press(screen.getByTestId('password-save'));
    expect(await screen.findByText('Your current password is incorrect.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('current-password'), 'admin@sober.com');
    await fireEvent.press(screen.getByTestId('password-save'));
    expect(await screen.findByText('Your password has been changed.')).toBeTruthy();
  });
});

describe('Saved answers', () => {
  it('lists blocking questions first and opens the editor with the question filled in', async () => {
    await renderWithProviders(<AnswersScreen />);
    expect(await screen.findByText('Needs an answer')).toBeTruthy();
    expect(screen.getByText('Asked 5 times')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save this answer: Are you willing to relocate to Oslo?'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/settings/answer', params: { topic: 'relocation', question: 'Are you willing to relocate to Oslo?', answer: '' } });
  });

  it('saves an answer that fills the blank question', async () => {
    mockParams.current = { topic: 'relocation', question: 'Are you willing to relocate to Oslo?' };
    const { services } = await renderWithProviders(<AnswerScreen />);
    await fireEvent.press(await screen.findByTestId('answer-save'));
    expect(await screen.findByText('This field is required.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('answer-text'), 'Yes');
    await fireEvent.press(screen.getByTestId('answer-save'));
    await waitFor(async () => expect((await services.api.approvals.getApproval('apr_oslo')).materials.answers.find((a) => a.id === 'q_relocate')?.answer).toBe('Yes'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('suggests the usual question for a topic', async () => {
    mockParams.current = {};
    await renderWithProviders(<AnswerScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Notice period' }));
    expect(screen.getByTestId('answer-question').props.value).toBe('What is your notice period?');
  });
});
