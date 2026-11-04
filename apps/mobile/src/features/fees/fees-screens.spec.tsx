import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FeeKind, PaymentStatus } from '@careerpilot/domain-ui-logic';
import { mockParams, createTestServices, renderWithProviders } from '@/test/render';
import { ConfidentialScreen } from '@/features/settings/confidential-screen';
import { FeesScreen } from './fees-screen';
import { PaymentScreen } from './payment-screen';

const payment = { title: 'Exam fee', amount: 700, currency: 'BDT', payee: 'Education Board' };

describe('fees screens', () => {
  it('shows an empty state and adds a fee', async () => {
    const services = createTestServices();
    const { unmount } = await renderWithProviders(<FeesScreen />, { services });
    expect(await screen.findByText(/Nothing recorded yet/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fees-add-rule'));
    await fireEvent.press(await screen.findByTestId('fees-save'));
    expect(await screen.findByText('Enter what the fee is for')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('What is it for'), 'Visa fee');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '120');
    await fireEvent.press(screen.getByTestId('fees-save'));
    expect(await screen.findByText('Visa fee')).toBeTruthy();
    expect(await services.api.fees.listRules()).toHaveLength(1);
    await unmount();
  });

  it('turns a fee into a payment record', async () => {
    const services = createTestServices();
    await services.api.fees.createRule({ kind: FeeKind.Job, title: 'Application fee', amount: 500, currency: 'BDT' });
    const { unmount } = await renderWithProviders(<FeesScreen />, { services });
    await fireEvent.press(await screen.findByText('Record a payment for this fee'));
    await waitFor(async () => expect(await services.api.fees.listPayments()).toHaveLength(1));
    await unmount();
  });

  it('never marks a payment paid without evidence and keeps an unknown outcome open', async () => {
    const services = createTestServices();
    const created = await services.api.fees.createPayment(payment);
    mockParams.current = { id: created.payment.id };
    const { unmount } = await renderWithProviders(<PaymentScreen />, { services });
    expect(await screen.findByText('Exam fee')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fees-apply'));
    expect(await screen.findByText(/Add a transaction ID or a receipt first/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Transaction ID'), 'TX-77');
    await fireEvent.press(screen.getByTestId('fees-apply'));
    await waitFor(async () => expect((await services.api.fees.getPayment(created.payment.id)).payment.status).toBe(PaymentStatus.Paid));
    await unmount();
  });

  it('adds employers to the excluded list and switches private notifications', async () => {
    const services = createTestServices();
    const { unmount } = await renderWithProviders(<ConfidentialScreen />, { services });
    expect(await screen.findByText(/No employers excluded/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Employer name'), 'Acme Ltd');
    await fireEvent.press(screen.getByText('Add employer'));
    await waitFor(async () => expect((await services.api.settings.getSettings()).excludedOrganizations).toEqual(['Acme Ltd']));
    await fireEvent(screen.getByTestId('private-notifications'), 'valueChange', true);
    await waitFor(async () => expect((await services.api.settings.getSettings()).privateNotifications).toBe(true));
    await unmount();
  });
});
