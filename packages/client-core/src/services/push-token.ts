import { useEffect } from 'react';
import type { PushDeviceRegistration } from '@careerpilot/api-client';
import { SessionStatus, useSession } from '../session/session';
import { useServices } from './app-services';

export const PUSH_TOKEN_KEY = 'careerpilot.pushToken';

export type PushTokenSource = () => Promise<PushDeviceRegistration | undefined>;

export function usePushRegistration(source: PushTokenSource | undefined): void {
  const { api, store } = useServices();
  const { status } = useSession();
  useEffect(() => {
    if (!source || status !== SessionStatus.SignedIn) {
      return undefined;
    }
    let active = true;
    source()
      .then(async (device) => {
        if (!active || !device) {
          return;
        }
        await api.messaging.registerPushDevice(device);
        await store.set(PUSH_TOKEN_KEY, device.token);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api, source, status, store]);
}
