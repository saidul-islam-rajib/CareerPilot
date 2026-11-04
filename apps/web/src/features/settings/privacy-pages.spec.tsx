import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ReportsPage } from '@/features/reports/reports-page';
import { ConsentsPage } from './consents-page';
import { ExportsPage } from './exports-page';

const openAddress = vi.hoisted(() => vi.fn());
vi.mock('@/core/open-address', () => ({ openAddress }));

describe('ExportsPage', () => {
  it('requests an export and offers the download link', async () => {
    renderWithProviders(<ExportsPage />);
    expect(await screen.findByText('No exports yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Applications as CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
    await waitFor(() => expect(openAddress).toHaveBeenCalledWith('https://files.example.test/export'));
  });
});

describe('ConsentsPage', () => {
  it('keeps required consents fixed and lets optional ones change', async () => {
    renderWithProviders(<ConsentsPage />);
    expect((await screen.findAllByText('Terms of Service')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Required')).toHaveLength(2);
    fireEvent.click(screen.getByRole('switch', { name: /Marketing messages/ }));
    await waitFor(() => expect(screen.getAllByText(/Allowed on/)).toHaveLength(3));
  });
});

describe('ReportsPage', () => {
  it('shows the daily report and switches to the weekly one', async () => {
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('No application activity in this period.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
    expect(await screen.findByText('No application activity in this period.')).toBeInTheDocument();
  });
});
