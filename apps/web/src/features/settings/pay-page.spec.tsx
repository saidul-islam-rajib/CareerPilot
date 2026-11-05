import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryStore } from '@careerpilot/client-core';
import { CompensationMode } from '@careerpilot/domain-ui-logic';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { PayPage } from './pay-page';

describe('pay page', () => {
  it('rejects a bad amount and saves a valid minimum', async () => {
    const services = createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
    renderWithProviders(<PayPage />, { services });
    const amount = await screen.findByLabelText('Minimum pay');
    fireEvent.change(amount, { target: { value: 'lots' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pay rule' }));
    expect(await screen.findByText('Enter a number such as 50000.')).toBeInTheDocument();
    fireEvent.change(amount, { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pay rule' }));
    await waitFor(async () => {
      const rule = (await services.api.settings.getSettings()).compensation;
      expect(rule.minimum).toEqual({ amountMinor: 5_000_000, currency: 'BDT' });
      expect(rule.mode).toBe(CompensationMode.Preference);
    });
  });
});
