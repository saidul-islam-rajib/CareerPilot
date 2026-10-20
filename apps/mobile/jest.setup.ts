import 'react-native-gesture-handler/jestSetup';
import { configure } from '@testing-library/react-native';

configure({ asyncUtilTimeout: 5000 });

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

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
  const Stack = Object.assign(() => null, { Screen: () => null, Protected: ({ children }: { children: unknown }) => children });
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    Stack,
    Tabs: Object.assign(() => null, { Screen: () => null }),
    Link: ({ children }: { children: unknown }) => React.createElement(React.Fragment, null, children),
  };
});

Object.assign(globalThis, { mockRouter, mockParams });

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockParams.current = {};
});
