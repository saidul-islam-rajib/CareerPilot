import * as SecureStore from 'expo-secure-store';
import type { KeyValueStore } from '@careerpilot/client-core';

export const secureStore: KeyValueStore = {
  get: async (key) => (await SecureStore.getItemAsync(key)) ?? undefined,
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};
