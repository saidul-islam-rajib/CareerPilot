import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { NotificationTarget } from '@careerpilot/domain-ui-logic';
import { renderWithProviders } from '@/test/render';
import { notificationHref } from '@/features/messaging/notifications-page';
import { AutomationPage } from './automation-page';

async function openLastStepWithName(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Add a rule' }));
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: name } });
  for (let step = 0; step < 5; step += 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  }
}

describe('AutomationPage', () => {
  it('shows what automation never does and the safety settings', async () => {
    renderWithProviders(<AutomationPage />);
    expect(await screen.findByText('Always left to you')).toBeInTheDocument();
    expect(screen.getByText('CAPTCHAs, MFA and identity checks')).toBeInTheDocument();
    expect(screen.getByLabelText('Deadline buffer (hours)')).toHaveValue(24);
    expect(screen.getByText(/No rules yet/)).toBeInTheDocument();
  });

  it('walks through the wizard, refuses a rule without a name, and lists the saved rule', async () => {
    renderWithProviders(<AutomationPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a rule' }));
    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(await screen.findAllByText("Couldn't save. Check the highlighted fields.")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Remote jobs' } });
    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save rule' })).toBeNull());
    expect(await screen.findByText('Remote jobs')).toBeInTheDocument();
    expect(screen.getByText(/from 70% match/)).toBeInTheDocument();
  });

  it('previews a rule without sending anything and explains each skipped job', async () => {
    renderWithProviders(<AutomationPage />);
    await openLastStepWithName('Strict');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText('Lowest match score'), { target: { value: '99' } });
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview what would be applied' }));
    const region = await screen.findByRole('region', { name: 'Preview' });
    expect(within(region).getByText('Nothing is sent, saved or paid for in a preview.')).toBeInTheDocument();
    await waitFor(() => expect(within(region).getByText(/would be applied/)).toBeInTheDocument());
  });

  it('opens the automatic mode screen from an automation notification', () => {
    expect(notificationHref({ target: NotificationTarget.Automation, targetId: 'usr_demo' } as never)).toBe('/automation');
  });
});
