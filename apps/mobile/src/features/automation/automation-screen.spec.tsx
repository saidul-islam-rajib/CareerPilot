import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { AutomationScreen } from './automation-screen';

describe('AutomationScreen', () => {
  it('lists what automation never does and previews without sending', async () => {
    const { unmount } = await renderWithProviders(<AutomationScreen />);
    expect(await screen.findByText(/CAPTCHAs, MFA and identity checks/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('automation-preview'));
    expect(await screen.findByTestId('dry-run-result')).toBeTruthy();
    expect(screen.getByText('Nothing is sent, saved or paid for in a preview.')).toBeTruthy();
    await unmount();
  });

  it('refuses a rule without a name and then saves it', async () => {
    const { unmount } = await renderWithProviders(<AutomationScreen />);
    await fireEvent.press(await screen.findByTestId('automation-add-rule'));
    for (let step = 0; step < 5; step += 1) {
      await fireEvent.press(screen.getByTestId('rule-next'));
    }
    await fireEvent.press(screen.getByTestId('rule-next'));
    expect(await screen.findByText("Couldn't save. Check the highlighted fields.")).toBeTruthy();
    for (let step = 0; step < 5; step += 1) {
      await fireEvent.press(screen.getByTestId('rule-back'));
    }
    await fireEvent.changeText(screen.getByTestId('rule-name'), 'Remote jobs');
    for (let step = 0; step < 5; step += 1) {
      await fireEvent.press(screen.getByTestId('rule-next'));
    }
    await fireEvent.press(screen.getByTestId('rule-next'));
    expect(await screen.findByText('Remote jobs')).toBeTruthy();
    await unmount();
  });
});
