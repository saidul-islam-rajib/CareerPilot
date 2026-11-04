import { fireEvent, screen, waitFor } from '@testing-library/react';
import { emptyProgramInput, emptyRefereeInput } from '@careerpilot/api-client';
import { createMemoryStore } from '@careerpilot/client-core';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { ProgramPage } from './program-page';
import { StudentsPage } from './students-page';

function seededServices() {
  return createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
}

describe('students page', () => {
  it('shows the notices and an empty overview', async () => {
    renderWithProviders(<StudentsPage />, { services: seededServices() });
    expect(await screen.findByText('Nothing needs attention.')).toBeInTheDocument();
    expect(screen.getByText(/never sends email/)).toBeInTheDocument();
  });

  it('adds a program and lists it', async () => {
    const services = seededServices();
    renderWithProviders(<StudentsPage />, { services });
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'MSc Data Science' } });
    fireEvent.change(screen.getByLabelText('University'), { target: { value: 'Northern University' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('MSc Data Science')).toBeInTheDocument();
    expect((await services.api.academic.listPrograms())[0]?.university).toBe('Northern University');
  });

  it('keeps a referee unusable until the user confirms agreement', async () => {
    const services = seededServices();
    await services.api.academic.createReferee({ ...emptyRefereeInput(), name: 'Dr Rahim' });
    renderWithProviders(<StudentsPage />, { services });
    fireEvent.click(await screen.findByRole('radio', { name: 'Referees' }));
    expect(await screen.findByText('Not confirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(async () => expect((await services.api.academic.listReferees())[0]?.consentConfirmedOn).toBeDefined());
  });
});

describe('program page', () => {
  it('shows the plan and refuses an unconfirmed offer action', async () => {
    const services = seededServices();
    const program = await services.api.academic.createProgram({
      ...emptyProgramInput(),
      title: 'PhD Robotics',
      university: 'Lakeside University',
      deadlines: [{ kind: 'application', on: '2027-01-15', note: '', sourceUrl: '' }],
    });
    renderWithProviders(<ProgramPage />, { services, params: { id: program.id } });
    expect(await screen.findByText('PhD Robotics')).toBeInTheDocument();
    expect(await screen.findByText('Nothing blocks submission.')).toBeInTheDocument();
    expect(screen.getByText('Available once you have an accepted or conditional offer.')).toBeInTheDocument();
  });
});
