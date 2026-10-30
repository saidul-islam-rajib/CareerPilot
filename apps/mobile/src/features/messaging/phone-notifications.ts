import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import type { AppNotification, PushDeviceRegistration } from '@careerpilot/api-client';
import { usePushRegistration, useServices, useT } from '@careerpilot/client-core';
import { DevicePlatform, NotificationTarget } from '@careerpilot/domain-ui-logic';
import { notificationRoute } from './inbox-screen';

type PushTarget = Pick<AppNotification, 'target' | 'targetId'>;

interface PushChannel {
  id: string;
  name: string;
}

const TARGETS: readonly string[] = Object.values(NotificationTarget);

export function pushTarget(response: Notifications.NotificationResponse | null | undefined): PushTarget | undefined {
  const data = response?.notification.request.content.data;
  const target = data?.target;
  const targetId = data?.targetId;
  if (typeof target !== 'string' || typeof targetId !== 'string' || !TARGETS.includes(target)) {
    return undefined;
  }
  return { target: target as NotificationTarget, targetId };
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export async function expoPushRegistration(channel: PushChannel): Promise<PushDeviceRegistration | undefined> {
  if (Platform.OS === 'web') {
    return undefined;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channel.id, { name: channel.name, importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    return undefined;
  }
  const id = projectId();
  const token = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
  return { token: token.data, platform: Platform.OS === 'ios' ? DevicePlatform.Ios : DevicePlatform.Android };
}

export function usePhoneNotifications(): void {
  const t = useT();
  const router = useRouter();
  const { config } = useServices();
  const channelName = t('notifications.channelName');
  const channel = useMemo(() => ({ id: config.messaging.push.channelId, name: channelName }), [config.messaging.push.channelId, channelName]);
  const source = useCallback(() => expoPushRegistration(channel), [channel]);
  usePushRegistration(Platform.OS === 'web' ? undefined : source);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }, []);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const target = pushTarget(response);
    if (!target) {
      return;
    }
    Notifications.clearLastNotificationResponse();
    router.push(notificationRoute(target));
  }, [response, router]);
}
