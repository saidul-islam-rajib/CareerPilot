import { fireEvent, screen, waitFor } from '@testing-library/react';
import { emptyCircularContent, emptyPost, type InMemoryGovernmentUser } from '@careerpilot/api-client';
import { createMemoryStore } from '@careerpilot/client-core';
import { createTestServices, navigation, renderWithProviders, testNow } from '@/test/render';
import { CircularPage } from './circular-page';
import { GovApplicationPage } from './application-page';
import { GovernmentPage, parseGrades } from './government-page';

function seededServices() {
  return createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
}

async function seed(services: ReturnType<typeof seededServices>) {
  const government = services.api.government as InMemoryGovernmentUser;
  return government.seedPublished({
    ...emptyCircularContent(),
    authority: 'Ministry of Public Administration',
    title: 'Recruitment of Assistant Officers',
    closesOn: '2026-11-12',
    fee: { amount: 112, windowHours: 48 },
    posts: [
      { ...emptyPost(), title: 'Assistant Officer', grade: 9, vacancies: 10, location: 'Dhaka' },
      { ...emptyPost(), title: 'Office Assistant', grade: 16, vacancies: 5, location: 'Sylhet' },
    ],
  });
}

describe('government pages', () => {
  it('reads grade lists', () => {
    expect(parseGrades('9, 10 and 11')).toEqual([9, 10, 11]);
    expect(parseGrades('')).toEqual([]);
  });

  it('lists circulars with posts and filters by grade', async () => {
    const services = seededServices();
    await seed(services);
    renderWithProviders(<GovernmentPage />, { services });
    expect(await screen.findByText('Recruitment of Assistant Officers')).toBeInTheDocument();
    expect(screen.getByText(/Assistant Officer · Grade 9/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Grades'), { target: { value: '16' } });
    expect(await screen.findByText(/Office Assistant · Grade 16/)).toBeInTheDocument();
    expect(screen.queryByText(/Assistant Officer · Grade 9/)).not.toBeInTheDocument();
  });

  it('shows each post and starts tracking the chosen one', async () => {
    const services = seededServices();
    const circular = await seed(services);
    renderWithProviders(<CircularPage />, { services, params: { id: circular.id } });
    expect(await screen.findByText('Office Assistant')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Track this application' }));
    expect(await screen.findByText('Choose at least one post.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Track this application' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
  });

  it('refuses to record a fee as paid without evidence and keeps submission with the user', async () => {
    const services = seededServices();
    const circular = await seed(services);
    const application = await services.api.government.startApplication(circular.id, [circular.posts[0]!.id]);
    renderWithProviders(<GovApplicationPage />, { services, params: { id: application.id } });
    expect(await screen.findByText('Fill in and submit the form yourself')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record as paid' }));
    expect(await screen.findByText('Add evidence first.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Payment evidence'), { target: { value: 'SMS received' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record as paid' }));
    await waitFor(async () => expect((await services.api.government.getApplication(application.id)).fee.status).toBe('paid'));
  });
});
