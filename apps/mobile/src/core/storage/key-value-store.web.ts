import type { KeyValueStore } from '@careerpilot/client-core';

function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export const secureStore: KeyValueStore = {
  get: async (key) => storage()?.getItem(key) ?? undefined,
  set: async (key, value) => storage()?.setItem(key, value),
  remove: async (key) => storage()?.removeItem(key),
};
