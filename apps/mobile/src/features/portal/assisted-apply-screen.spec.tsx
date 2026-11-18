import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import type { FillPlan } from '@careerpilot/api-client';
import { AttemptState, HostPolicy, StopReason } from '@careerpilot/domain-ui-logic';
import { mockParams, mockRouter, createTestServices, renderWithProviders } from '@/test/render';
import { AssistCopyPanel } from './assist-copy-panel';
import { AssistedApplyScreen } from './assisted-apply-screen';

const blockedPlan: FillPlan = {
  applicationId: 'a1',
  officialUrl: 'https://blocked.example.com/apply',
  host: 'blocked.example.com',
  hostPolicy: HostPolicy.Blocked,
  assistAllowed: false,
  accountEmail: 'me@example.com',
  hasPassword: false,
  facts: [{ fact: 'full_name', value: 'Rahim Uddin', autocomplete: [], names: [], labels: [] }],
  answers: [],
  coverLetter: '',
  coverLetterLabels: [],
  resumeLabels: [],
  confirmationPhrases: [],
  skipTerms: [],
  captchaSelectors: [],
  scanIntervalMs: 1500,
  excerptChars: 300,
};

async function seededApplication() {
  const services = createTestServices();
  const application = (await services.api.applications.listApplications('all'))[0];
  const attempt = {
    applicationId: application.id,
    state: AttemptState.Stopped,
    stop: StopReason.Captcha,
    detail: '',
    officialUrl: 'https://jobs.example.com/apply',
    host: 'jobs.example.com',
    prepared: [],
    pending: [],
    submitClicked: false,
    runs: 1,
    finalUrl: '',
    confirmationText: '',
    evidenceKey: '',
    updatedAt: '',
  };
  (services.api.portal as unknown as { seedAttempt: (view: typeof attempt) => void }).seedAttempt(attempt);
  return { services, applicationId: application.id };
}

describe('assisted apply', () => {
  it('opens the employer page with the bar and the user-only note', async () => {
    const { services, applicationId } = await seededApplication();
    mockParams.current = { id: applicationId };
    const { unmount } = await renderWithProviders(<AssistedApplyScreen />, { services });
    expect(await screen.findByTestId('assist-webview')).toBeTruthy();
    expect(screen.getByText('You complete the check and tap Submit.')).toBeTruthy();
    expect(screen.getByText('0 fields filled · 0 left for you')).toBeTruthy();
    expect(screen.getByTestId('assist-mark-complete')).toBeTruthy();
    expect(screen.queryByTestId('assist-record')).toBeNull();
    await unmount();
  });

  it('offers the saved password only after the user asks for it', async () => {
    const { services, applicationId } = await seededApplication();
    await services.api.portal.addAccount({ host: 'jobs.example.com', employer: 'Acme', email: 'me@example.com', password: 'secret-pw' });
    mockParams.current = { id: applicationId };
    const { unmount } = await renderWithProviders(<AssistedApplyScreen />, { services });
    const button = await screen.findByTestId('assist-use-password');
    expect(screen.queryByText(/secret-pw/)).toBeNull();
    await fireEvent.press(button);
    await waitFor(() => expect(screen.getByTestId('assist-use-password')).toBeTruthy());
    await unmount();
  });

  it('gives a blocked host the official link and copy buttons only', async () => {
    const { unmount } = await renderWithProviders(<AssistCopyPanel plan={blockedPlan} applicationId="a1" showLinkOnlyNote />);
    expect(screen.queryByTestId('assist-webview')).toBeNull();
    expect(screen.getByText(/not opened inside the app/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('assist-open-official'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://blocked.example.com/apply');
    await fireEvent.press(screen.getByTestId('assist-copy-fact-full_name'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Rahim Uddin'));
    expect(mockRouter.push).not.toHaveBeenCalled();
    await unmount();
  });
});
