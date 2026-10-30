import 'react-native-gesture-handler/jestSetup';
import { configure } from '@testing-library/react-native';

configure({ asyncUtilTimeout: 5000 });

jest.mock('react-native-reanimated/src/initializers', () => ({ initializeReanimatedModule: () => undefined }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0', extra: {} } } }));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })) }));

jest.mock('expo-audio', () => {
  const recorder = { prepareToRecordAsync: jest.fn(() => Promise.resolve()), record: jest.fn(), stop: jest.fn(() => Promise.resolve()), uri: 'file:///voice.m4a' };
  const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()) };
  return {
    RecordingPresets: { HIGH_QUALITY: {} },
    requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    useAudioRecorder: () => recorder,
    useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({ playing: false, currentTime: 0, duration: 0, didJustFinish: false }),
  };
});

const mockNotificationResponse: { current: unknown } = { current: undefined };

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ type: 'expo', data: 'ExponentPushToken[testDevice]' })),
  useLastNotificationResponse: () => mockNotificationResponse.current,
  clearLastNotificationResponse: jest.fn(() => {
    mockNotificationResponse.current = null;
  }),
}));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })) }));

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => Promise.resolve(void values.set(key, value))),
    deleteItemAsync: jest.fn((key: string) => Promise.resolve(void values.delete(key))),
  };
});

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams: { current: Record<string, string> } = { current: {} };

jest.mock('expo-router', () => {
  const React = require('react');
  const HeaderActions = ({ options }: { options?: { headerRight?: () => unknown } }) => options?.headerRight?.() ?? null;
  const Stack = Object.assign(() => null, { Screen: HeaderActions, Protected: ({ children }: { children: unknown }) => children });
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    Stack,
    Tabs: Object.assign(() => null, { Screen: () => null }),
    Link: ({ children }: { children: unknown }) => React.createElement(React.Fragment, null, children),
  };
});

Object.assign(globalThis, { mockRouter, mockParams, mockNotificationResponse });

beforeEach(() => {
  mockNotificationResponse.current = undefined;
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockParams.current = {};
});
