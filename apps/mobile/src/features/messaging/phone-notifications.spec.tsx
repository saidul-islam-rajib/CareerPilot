import { act, waitFor } from '@testing-library/react-native';
import { PUSH_TOKEN_KEY, useSession } from '@careerpilot/client-core';
import { createTestServices, mockNotificationResponse, mockRouter, renderWithProviders } from '@/test/render';
import { usePhoneNotifications } from './phone-notifications';

const DEVICE_TOKEN = 'ExponentPushToken[testDevice]';
let signOut: () => Promise<void> = () => Promise.resolve();

function PhoneNotifications() {
  usePhoneNotifications();
  signOut = useSession().end;
  return null;
}

describe('phone notifications', () => {
  it('registers this phone for pushes and forgets it on sign-out', async () => {
    const services = createTestServices();
    const register = jest.spyOn(services.api.messaging, 'registerPushDevice');
    const unregister = jest.spyOn(services.api.messaging, 'unregisterPushDevice');
    await renderWithProviders(<PhoneNotifications />, { services });
    await waitFor(async () => expect(await services.store.get(PUSH_TOKEN_KEY)).toBe(DEVICE_TOKEN));
    expect(register).toHaveBeenCalledWith({ token: DEVICE_TOKEN, platform: 'ios' });
    await act(() => signOut());
    expect(unregister).toHaveBeenCalledWith(DEVICE_TOKEN);
    expect(await services.store.get(PUSH_TOKEN_KEY)).toBeUndefined();
  });

  it('opens the chat or job from a tapped notification', async () => {
    mockNotificationResponse.current = {
      actionIdentifier: 'default',
      notification: { request: { identifier: 'n1', content: { data: { kind: 'message', target: 'conversation', targetId: 'cnv_karim' } } } },
    };
    await renderWithProviders(<PhoneNotifications />);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'cnv_karim' } }));
  });

  it('ignores notifications without a known target', async () => {
    mockNotificationResponse.current = { notification: { request: { identifier: 'n2', content: { data: { target: 'elsewhere', targetId: 'x' } } } } };
    await renderWithProviders(<PhoneNotifications />);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
