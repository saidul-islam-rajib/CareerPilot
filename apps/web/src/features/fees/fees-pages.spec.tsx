import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryStore } from '@careerpilot/client-core';
import { FeeKind, PaymentAction, PaymentStatus } from '@careerpilot/domain-ui-logic';
import { ConfidentialPage } from '@/features/settings/confidential-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { FeesPage } from './fees-page';
import { PaymentPage } from './payment-page';

function seededServices() {
  return createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
}

const payment = { title: 'Exam fee', amount: 700, currency: 'BDT', payee: 'Education Board' };

describe('fees pages', () => {
  it('shows an empty state and then a recorded fee with a reminder', async () => {
    const services = seededServices();
    renderWithProviders(<FeesPage />, { services });
    expect(await screen.findByText(/Nothing recorded yet/)).toBeInTheDocument();
    await services.api.fees.createRule({
      kind: FeeKind.Job,
      title: 'Application fee',
      amount: 500,
      currency: 'BDT',
      deadline: new Date(testNow.getTime() + 86_400_000).toISOString(),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a fee' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Enter what the fee is for')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('What is it for'), { target: { value: 'Visa fee' } });
    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '120' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Visa fee')).toBeInTheDocument();
    expect(screen.getAllByText('Application fee').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Due soon').length).toBeGreaterThan(0);
  });

  it('turns a fee into a payment record', async () => {
    const services = seededServices();
    await services.api.fees.createRule({ kind: FeeKind.Job, title: 'Application fee', amount: 500, currency: 'BDT' });
    renderWithProviders(<FeesPage />, { services });
    fireEvent.click(await screen.findByRole('button', { name: 'Record a payment for this fee' }));
    await waitFor(async () => expect(await services.api.fees.listPayments()).toHaveLength(1));
  });

  it('never marks a payment paid without evidence and keeps an unknown outcome open', async () => {
    const services = seededServices();
    const created = await services.api.fees.createPayment(payment);
    renderWithProviders(<PaymentPage />, { services, params: { id: created.payment.id } });
    expect(await screen.findByText('Exam fee')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: PaymentAction.ConfirmPaid } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText(/Add a transaction ID or a receipt first/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: PaymentAction.MarkUncertain } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('Did this payment go through?')).toBeInTheDocument();
    expect(screen.getByText(/Do not pay again/)).toBeInTheDocument();
    expect((await services.api.fees.getPayment(created.payment.id)).payment.status).toBe(PaymentStatus.Uncertain);
  });

  it('records the payment as paid once a transaction id is given and keeps receipts', async () => {
    const services = seededServices();
    const created = await services.api.fees.createPayment(payment);
    renderWithProviders(<PaymentPage />, { services, params: { id: created.payment.id } });
    await screen.findByText('Exam fee');
    fireEvent.change(screen.getByLabelText('Transaction ID'), { target: { value: 'TX-77' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(async () => expect((await services.api.fees.getPayment(created.payment.id)).payment.status).toBe(PaymentStatus.Paid));
    fireEvent.change(screen.getByLabelText('Reference or message text'), { target: { value: 'R-100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add receipt' }));
    expect(await screen.findByText('R-100')).toBeInTheDocument();
  });
});

describe('confidential search settings', () => {
  it('adds and removes excluded employers and switches private notifications', async () => {
    const { services } = renderWithProviders(<ConfidentialPage />);
    expect(await screen.findByText(/No employers excluded/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Employer name'), { target: { value: 'Acme Ltd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add employer' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).excludedOrganizations).toEqual(['Acme Ltd']));
    fireEvent.click(screen.getByRole('switch', { name: 'Private notifications' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).privateNotifications).toBe(true));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Acme Ltd' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).excludedOrganizations).toEqual([]));
  });

  it('is linked from settings together with fees', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('link', { name: /Confidential search/ })).toHaveAttribute('href', '/settings/confidential');
    expect(screen.getByRole('link', { name: /Fees and payments/ })).toHaveAttribute('href', '/fees');
  });
});
