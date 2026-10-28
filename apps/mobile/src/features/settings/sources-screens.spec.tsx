import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SourceReview } from '@careerpilot/domain-ui-logic';
import { createTestServices, mockRouter, renderWithProviders } from '@/test/render';
import { AddSourceScreen, SourcesScreen } from './sources-screens';

describe('AddSourceScreen', () => {
  it('checks the link, adds the source for review, and goes back', async () => {
    const { services } = await renderWithProviders(<AddSourceScreen />);
    await fireEvent.press(await screen.findByTestId('source-submit'));
    expect(await screen.findByText('This field is required.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('source-url'), 'ftp://jobs.example.org');
    await fireEvent.press(screen.getByTestId('source-submit'));
    expect(await screen.findByText('Use a website on the public internet.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('source-url'), 'careers.example.org');
    await fireEvent.changeText(screen.getByTestId('source-note'), 'Hires in Dhaka');
    await fireEvent.press(screen.getByTestId('source-submit'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const [source] = await services.api.sources.listSources();
    expect(source).toMatchObject({ name: 'careers.example.org', siteUrl: 'https://careers.example.org', review: SourceReview.Pending });
  });
});

describe('SourcesScreen', () => {
  it('starts empty and opens the add screen', async () => {
    await renderWithProviders(<SourcesScreen />);
    expect(await screen.findByText(/You haven.t added any sources yet/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-source'));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/source');
  });

  it('lists sources waiting for review and removes one after confirming', async () => {
    const services = createTestServices();
    const added = await services.api.sources.addSource({ url: 'careers.example.org' });
    await renderWithProviders(<SourcesScreen />, { services });
    expect(await screen.findByText('Waiting for review')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`source-remove-${added.id}`));
    await fireEvent.press(screen.getByTestId(`source-remove-confirm-${added.id}`));
    await waitFor(async () => expect(await services.api.sources.listSources()).toEqual([]));
  });
});
