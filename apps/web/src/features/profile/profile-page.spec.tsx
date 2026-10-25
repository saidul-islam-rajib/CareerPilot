import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { ProfilePage } from './profile-page';

async function renderProfile() {
  const view = renderWithProviders(<ProfilePage />);
  await screen.findByRole('heading', { name: 'Ayesha Rahman', level: 1 });
  return view;
}

function region(name: string) {
  return screen.getByRole('region', { name });
}

async function chooseMenuItem(user: ReturnType<typeof userEvent.setup>, menuLabel: string, item: string) {
  await user.click(screen.getByRole('button', { name: menuLabel }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('ProfilePage', () => {
  it('shows completeness, the next step, and every configured section', async () => {
    await renderProfile();
    expect(screen.getByRole('progressbar', { name: /Profile \d+% complete/ })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Profile sections' });
    for (const name of ['About', 'Emails and phones', 'Experience', 'Education', 'Skills', 'Documents', 'Languages', 'Tests and scores', 'Certifications', 'Projects', 'Links', 'Awards and publications', 'Referees']) {
      expect(within(nav).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(within(region('Experience')).getByRole('button', { name: 'Frontend Engineer' })).toBeInTheDocument();
    expect(within(region('Languages')).getByText(/Native/)).toBeInTheDocument();
  });

  it('edits basics and shows the change', async () => {
    const user = userEvent.setup();
    const { services } = await renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit basics' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit basics' });
    const headline = within(dialog).getByLabelText('Headline');
    await user.clear(headline);
    await user.type(headline, 'Senior frontend engineer');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await services.api.profile.getProfile()).headline).toBe('Senior frontend engineer'));
    expect(await screen.findByText('Senior frontend engineer')).toBeInTheDocument();
  });

  it('validates and adds an experience entry from the configured fields', async () => {
    const user = userEvent.setup();
    const { services } = await renderProfile();
    await user.click(within(region('Experience')).getByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add experience' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Please fix 3 highlighted fields.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Job title'), 'Staff Engineer');
    await user.type(within(dialog).getByLabelText('Company or organization'), 'Kite Commerce');
    fireEvent.change(within(dialog).getByLabelText('Start'), { target: { value: '2025-01' } });
    await user.click(within(dialog).getByRole('checkbox', { name: 'I currently work here' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const titles = (await services.api.profile.getProfile()).sections.experience?.map((e) => e.values.title);
      expect(titles).toContain('Staff Engineer');
    });
    expect(await within(region('Experience')).findByRole('button', { name: 'Staff Engineer' })).toBeInTheDocument();
  });

  it('removes an entry and restores it with undo', async () => {
    const user = userEvent.setup();
    const { services } = await renderProfile();
    await chooseMenuItem(user, 'More actions for IELTS Academic', 'Remove');
    await waitFor(async () => expect((await services.api.profile.getProfile()).sections.tests).toEqual([]));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await services.api.profile.getProfile()).sections.tests?.map((e) => e.values.test)).toEqual(['IELTS Academic']));
  });

  it('reorders contacts and changes the primary email from the menu', async () => {
    const user = userEvent.setup();
    const { services } = await renderProfile();
    await chooseMenuItem(user, 'More actions for admin@sober.com', 'Move down');
    await waitFor(async () => {
      const contacts = (await services.api.profile.getProfile()).contacts.sort((a, b) => a.position - b.position);
      expect(contacts[0]?.id).toBe('c_phone_mobile');
    });
    await chooseMenuItem(user, 'More actions for ayesha.personal@example.com', 'Make primary');
    await waitFor(async () => {
      const profile = await services.api.profile.getProfile();
      expect(profile.contacts.find((c) => c.isPrimary && c.kind === 'email')?.id).toBe('c_email_personal');
    });
  });

  it('adds a phone contact after checking its format', async () => {
    const user = userEvent.setup();
    const { services } = await renderProfile();
    await user.click(within(region('Emails and phones')).getByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add email or phone' });
    await user.click(within(dialog).getByRole('radio', { name: 'Phone' }));
    const value = within(dialog).getByLabelText('Phone number with country code');
    await user.type(value, 'call me');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Enter a valid phone number with country code.')).toBeInTheDocument();
    await user.clear(value);
    await user.type(value, '+8801900000000');
    await user.type(within(dialog).getByLabelText('Label'), 'Office');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await services.api.profile.getProfile()).contacts.some((c) => c.value === '+8801900000000')).toBe(true));
  });

  it('adds and removes skills with undo', async () => {
    const user = userEvent.setup();
    const { services } = await renderProfile();
    const input = within(region('Skills')).getByRole('textbox', { name: 'Add skill' });
    await user.type(input, 'GraphQL{Enter}');
    await waitFor(async () => expect((await services.api.profile.getProfile()).skills).toContain('GraphQL'));
    await user.click(within(region('Skills')).getByRole('button', { name: 'Remove GraphQL' }));
    await waitFor(async () => expect((await services.api.profile.getProfile()).skills).not.toContain('GraphQL'));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await services.api.profile.getProfile()).skills).toContain('GraphQL'));
  });

  it('uploads a PDF and rejects other files', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { services } = await renderProfile();
    const input = within(region('Documents')).getByLabelText('Drag a PDF here, or choose a file');
    await user.upload(input, new File(['%PDF-1.4'], 'Remote CV.pdf', { type: 'application/pdf' }));
    await waitFor(async () => expect((await services.api.profile.getProfile()).documents.map((d) => d.name)).toContain('Remote CV'));
    expect(await screen.findByText('Remote CV.pdf uploaded')).toBeInTheDocument();
    await user.upload(input, new File(['png'], 'photo.png', { type: 'image/png' }));
    expect(await screen.findByText('Choose a PDF file.')).toBeInTheDocument();
  });

  it('opens the zoomable photo viewer', async () => {
    await renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Photo. Tap to view and zoom' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    expect(within(dialog).getByText('200%')).toBeInTheDocument();
  });
});
