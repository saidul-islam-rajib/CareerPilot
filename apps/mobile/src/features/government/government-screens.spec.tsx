import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { emptyCircularContent, emptyPost, type InMemoryGovernmentUser } from '@careerpilot/api-client';
import { mockParams, mockRouter, createTestServices, renderWithProviders } from '@/test/render';
import { GovApplicationScreen } from './application-screen';
import { CircularScreen } from './circular-screen';
import { GovernmentScreen, parseGrades } from './government-screen';

async function seed(services: ReturnType<typeof createTestServices>) {
  const government = services.api.government as InMemoryGovernmentUser;
  return government.seedPublished({
    ...emptyCircularContent(),
    authority: 'Ministry of Public Administration',
    title: 'Recruitment of Assistant Officers',
    closesOn: '2026-11-12',
    fee: { amount: 112, windowHours: 48 },
    posts: [
      { ...emptyPost(), title: 'Assistant Officer', grade: 9, vacancies: 10 },
      { ...emptyPost(), title: 'Office Assistant', grade: 16, vacancies: 5 },
    ],
  });
}

describe('government screens', () => {
  it('reads grade lists', () => {
    expect(parseGrades('9, 10 and 11')).toEqual([9, 10, 11]);
  });

  it('lists circulars and filters by grade', async () => {
    const services = createTestServices();
    await seed(services);
    const { unmount } = await renderWithProviders(<GovernmentScreen />, { services });
    expect(await screen.findByText(/Assistant Officer · Grade 9/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Grades'), '16');
    expect(await screen.findByText(/Office Assistant · Grade 16/)).toBeTruthy();
    expect(screen.queryByText(/Assistant Officer · Grade 9/)).toBeNull();
    await unmount();
  });

  it('starts tracking the chosen post', async () => {
    const services = createTestServices();
    const circular = await seed(services);
    mockParams.current = { id: circular.id };
    const { unmount } = await renderWithProviders(<CircularScreen />, { services });
    expect(await screen.findByText('Office Assistant')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('government-start'));
    expect(await screen.findByText('Choose at least one post.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Assistant Officer'));
    await fireEvent.press(screen.getByTestId('government-start'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    await unmount();
  });

  it('asks for evidence before a fee is recorded as paid', async () => {
    const services = createTestServices();
    const circular = await seed(services);
    const application = await services.api.government.startApplication(circular.id, [circular.posts[0]!.id]);
    mockParams.current = { id: application.id };
    const { unmount } = await renderWithProviders(<GovApplicationScreen />, { services });
    expect(await screen.findByText('Fill in and submit the form yourself')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('government-mark-paid'));
    expect(await screen.findByText('Add evidence first.')).toBeTruthy();
    await unmount();
  });
});
