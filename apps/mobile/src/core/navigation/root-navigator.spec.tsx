import { Pressable, Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useSession } from '@careerpilot/client-core';
import { TestProviders, createTestServices, demoSession } from '@/test/render';
import { RootNavigator } from './root-navigator';

jest.unmock('expo-router');

function WelcomePage() {
  const session = useSession();
  return (
    <Pressable accessibilityRole="button" onPress={() => void session.start(demoSession)}>
      <Text>Welcome page</Text>
    </Pressable>
  );
}

function HomePage() {
  const session = useSession();
  return (
    <Pressable accessibilityRole="button" onPress={() => void session.end()}>
      <Text>Home page</Text>
    </Pressable>
  );
}

function appRoutes(signedIn: boolean) {
  const services = createTestServices(signedIn);
  return {
    _layout: () => (
      <TestProviders services={services}>
        <RootNavigator />
      </TestProviders>
    ),
    '(auth)/_layout': { default: () => <Stack />, unstable_settings: { anchor: 'welcome' } },
    '(auth)/welcome': WelcomePage,
    '(auth)/sign-in': () => <Text>Sign-in page</Text>,
    '(app)/_layout': () => <Stack />,
    '(app)/(tabs)/_layout': () => <Stack />,
    '(app)/(tabs)/index': HomePage,
    '(app)/(tabs)/approvals': () => <Text>Approvals page</Text>,
  };
}

describe('RootNavigator', () => {
  it('opens the welcome screen for a signed-out visitor at the home address', async () => {
    await renderRouter(appRoutes(false), { initialUrl: '/' });
    expect(await screen.findByText('Welcome page')).toBeTruthy();
    expect(screen).toHavePathname('/welcome');
  });

  it('keeps signed-in pages away from a signed-out visitor', async () => {
    await renderRouter(appRoutes(false), { initialUrl: '/approvals' });
    expect(await screen.findByText('Welcome page')).toBeTruthy();
    expect(screen).toHavePathname('/welcome');
  });

  it('opens home for a signed-in user who lands on sign-in', async () => {
    await renderRouter(appRoutes(true), { initialUrl: '/sign-in' });
    expect(await screen.findByText('Home page')).toBeTruthy();
    expect(screen).toHavePathname('/');
  });

  it('moves to home after signing in and back to welcome after signing out', async () => {
    await renderRouter(appRoutes(false), { initialUrl: '/' });
    await fireEvent.press(await screen.findByText('Welcome page'));
    await fireEvent.press(await screen.findByText('Home page'));
    expect(await screen.findByText('Welcome page')).toBeTruthy();
    expect(screen).toHavePathname('/welcome');
  });
});
