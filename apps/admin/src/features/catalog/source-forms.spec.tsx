import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OpportunityType, WorkArrangement } from '@careerpilot/domain-ui-logic';
import { renderAdmin, suggestedSources } from '@/test/render';
import { SourcesPage } from './catalog-pages';
import { newSourceFrom, sourceProblemKey } from './source-forms';

const FIRST = { name: suggestedSources[0]!.name ?? '' };
const SUBMIT = 'Find jobs and add';
const DEFAULTS = { type: OpportunityType.Job, workArrangement: WorkArrangement.Remote };

describe('adding job sources', () => {
  it('adds a suggested source with one click', async () => {
    await renderAdmin(<SourcesPage />);
    const add = await screen.findByRole('button', { name: `Add: ${FIRST.name}` });
    fireEvent.click(add);
    expect(await screen.findByText(`${FIRST.name} added with 0 jobs. They're being matched to users.`)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: `Add: ${FIRST.name}` })).not.toBeInTheDocument());
    expect((await screen.findAllByText(FIRST.name)).length).toBeGreaterThan(0);
  });

  it('adds a source from just a website link and explains unusable addresses', async () => {
    await renderAdmin(<SourcesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add source' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('How to read it')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: SUBMIT }));
    expect(await within(dialog).findAllByText('This field is required.')).toHaveLength(1);
    fireEvent.change(within(dialog).getByLabelText('Website link'), { target: { value: 'ftp://jobs.example.org' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SUBMIT }));
    expect(await within(dialog).findByText('Use a website on the public internet.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Website link'), { target: { value: 'jobs.example.org' } });
    fireEvent.change(within(dialog).getByLabelText('Name (optional)'), { target: { value: 'Company board' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SUBMIT }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Company board')).toBeInTheDocument();
  });

  it('shows the reader and listing defaults under more options', async () => {
    await renderAdmin(<SourcesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add source' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'More options' }));
    expect(within(dialog).getByText('How to read it')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Country code (optional)')).toBeInTheDocument();
  });

  it('offers adding only to admins allowed to create sources', async () => {
    await renderAdmin(<SourcesPage />, { email: 'operations@sober.com' });
    await screen.findByText('Sources');
    expect(screen.queryByRole('button', { name: 'Add source' })).not.toBeInTheDocument();
    expect(screen.queryByText('Suggested sources')).not.toBeInTheDocument();
  });
});

describe('source form values', () => {
  const form = { url: ' acme.example.org ', name: ' Acme ', connector: 'auto', defaults: DEFAULTS };

  it('sends only the link and name unless more options are open', () => {
    expect(newSourceFrom(form, false)).toEqual({ url: 'acme.example.org', name: 'Acme' });
    expect(newSourceFrom(form, true)).toEqual({ url: 'acme.example.org', name: 'Acme', connector: '', defaults: DEFAULTS });
    expect(newSourceFrom({ ...form, connector: 'lever' }, true).connector).toBe('lever');
  });

  it('explains known check problems and falls back for others', () => {
    expect(sourceProblemKey('invalid_feed')).toBe('admin.sources.problems.invalid_feed');
    expect(sourceProblemKey('SomethingElse')).toBe('admin.sources.problems.other');
  });
});
