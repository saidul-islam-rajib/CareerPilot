import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { emptyProgramInput, emptyRefereeInput } from '@careerpilot/api-client';
import { DeadlineKind } from '@careerpilot/domain-ui-logic';
import { mockParams, createTestServices, renderWithProviders } from '@/test/render';
import { ProgramScreen } from './program-screen';
import { StudentsScreen } from './students-screen';

describe('students screen', () => {
  it('shows the notices and an empty overview', async () => {
    const { unmount } = await renderWithProviders(<StudentsScreen />, { services: createTestServices() });
    expect(await screen.findByText('Nothing needs attention.')).toBeTruthy();
    expect(screen.getByText(/never sends email/)).toBeTruthy();
    await unmount();
  });

  it('adds a program', async () => {
    const services = createTestServices();
    const { unmount } = await renderWithProviders(<StudentsScreen />, { services });
    await fireEvent.changeText(await screen.findByLabelText('Title'), 'MSc Data Science');
    await fireEvent.changeText(screen.getByLabelText('University'), 'Northern University');
    await fireEvent.press(screen.getByText('Add'));
    expect(await screen.findByText(/Northern University/)).toBeTruthy();
    await waitFor(async () => expect((await services.api.academic.listPrograms())[0]?.title).toBe('MSc Data Science'));
    await unmount();
  });

  it('keeps a referee unusable until the user confirms agreement', async () => {
    const services = createTestServices();
    await services.api.academic.createReferee({ ...emptyRefereeInput(), name: 'Dr Rahim' });
    const { unmount } = await renderWithProviders(<StudentsScreen />, { services });
    await fireEvent.press(await screen.findByLabelText('Referees'));
    expect(await screen.findByText('Not confirmed')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dr Rahim This referee agreed to be listed'));
    await waitFor(async () => expect((await services.api.academic.listReferees())[0]?.consentConfirmedOn).toBeDefined());
    await unmount();
  });
});

describe('program screen', () => {
  it('shows the plan and explains that the checklist needs an offer', async () => {
    const services = createTestServices();
    const program = await services.api.academic.createProgram({
      ...emptyProgramInput(),
      title: 'PhD Robotics',
      university: 'Lakeside University',
      deadlines: [{ kind: DeadlineKind.Application, on: '2027-01-15', note: '', sourceUrl: '' }],
    });
    mockParams.current = { id: program.id };
    const { unmount } = await renderWithProviders(<ProgramScreen />, { services });
    expect(await screen.findByText('PhD Robotics')).toBeTruthy();
    expect(await screen.findByText('Nothing blocks submission.')).toBeTruthy();
    expect(screen.getByText('Available once you have an accepted or conditional offer.')).toBeTruthy();
    await unmount();
  });
});
