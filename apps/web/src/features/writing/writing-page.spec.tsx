import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ApprovalPage } from '../approvals/approval-page';
import { WritingPage } from './writing-page';

const PARAMS = { opportunityId: 'opp_remote_frontend' };

async function writeLetter() {
  const view = renderWithProviders(<WritingPage />, { params: PARAMS });
  await screen.findByText('Writing for Senior Frontend Engineer at Northwind Labs');
  fireEvent.click(screen.getByRole('button', { name: 'Write a draft' }));
  await screen.findByRole('heading', { name: 'Version 1' });
  return view;
}

describe('WritingPage', () => {
  it('says AI is not configured and blocks kinds that need it', async () => {
    renderWithProviders(<WritingPage />, { params: PARAMS });
    expect(await screen.findByText(/AI is not configured on this server/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Essay answer/ }));
    expect(await screen.findByText('This kind of writing needs AI, which is not configured.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write a draft' })).toBeDisabled();
  });

  it('writes a template draft from profile facts and passes the checks', async () => {
    await writeLetter();
    expect(screen.getByText('Template from your profile facts')).toBeInTheDocument();
    expect((screen.getByLabelText('Text') as HTMLTextAreaElement).value).toContain('Northwind Labs');
    expect(screen.getByText('No unsupported claims, other employers or placeholders found.')).toBeInTheDocument();
  });

  it('flags another employer, offers to remove it, and keeps the old version', async () => {
    await writeLetter();
    fireEvent.change(screen.getByLabelText('Text'), {
      target: { value: 'Dear Northwind Labs hiring team, I want to join.\n\nI also admire Kite Commerce.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new version' }));
    expect(await screen.findByRole('heading', { name: 'Version 2' })).toBeInTheDocument();
    expect(await screen.findByText(/Mentions another employer \(Kite Commerce\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to application' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove flagged sentences' }));
    expect(await screen.findByRole('heading', { name: 'Version 3' })).toBeInTheDocument();
    expect((screen.getByLabelText('Text') as HTMLTextAreaElement).value).not.toContain('Kite Commerce');
    expect(screen.getByRole('button', { name: /Version 1/ })).toBeInTheDocument();
  });

  it('adds a passing draft to the application and shows it on the approval screen', async () => {
    const { services } = await writeLetter();
    const add = await screen.findByRole('button', { name: 'Add to application' });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    expect(await screen.findByText('In the application for approval')).toBeInTheDocument();
    const approval = await services.api.approvals.getApproval('apr_frontend');
    expect(approval.materials.writing).toHaveLength(1);
    renderWithProviders(<ApprovalPage />, { params: { id: 'apr_frontend' }, services });
    const section = (await screen.findAllByText(/Cover letter, version 1 \(Template from your profile facts\)/))[0]!;
    expect(within(section.closest('div')!.parentElement!).getByText(/Dear Northwind Labs/)).toBeInTheDocument();
  });

  it('removes a version after confirmation', async () => {
    await writeLetter();
    fireEvent.click(screen.getByRole('button', { name: 'Delete this version' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No drafts yet for this application.')).toBeInTheDocument();
  });
});
