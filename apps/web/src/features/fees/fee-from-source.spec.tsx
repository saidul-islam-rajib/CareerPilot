import { fireEvent, screen } from '@testing-library/react';
import { createMemoryStore, FeeSourceKind } from '@careerpilot/client-core';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { FeeFromSource } from './fee-from-source';

describe('fee from source', () => {
  it('shows the failure when the listing states no fee', async () => {
    const services = createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
    renderWithProviders(<FeeFromSource kind={FeeSourceKind.Opportunity} id="opp_1" />, { services });
    fireEvent.click(screen.getByRole('button', { name: 'Create fee rule from this opportunity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No fee is stated here. Add the fee yourself.');
  });
});
