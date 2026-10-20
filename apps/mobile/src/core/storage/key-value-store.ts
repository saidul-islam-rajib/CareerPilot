import * as SecureStore from 'expo-secure-store';

export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const secureStore: KeyValueStore = {
  get: async (key) => (await SecureStore.getItemAsync(key)) ?? undefined,
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};
