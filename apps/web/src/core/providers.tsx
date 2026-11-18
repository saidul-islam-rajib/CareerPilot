'use client';

import { useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { systemClock } from '@careerpilot/api-client';
import { AppServicesProvider, PublicConfigProvider, SessionProvider, createAppServices, createBffTransport, createQueryClient, type AppServices } from '@careerpilot/client-core';
import { ThemeFromConfig, ToastProvider } from '@careerpilot/ui-web';
import { sessionStore } from './session-store';
import { getWebConfig } from './web-config';

export interface ProvidersProps {
  services?: AppServices;
  queryClient?: QueryClient;
}

function webServices(): AppServices {
  const config = getWebConfig();
  return createAppServices(config, sessionStore, systemClock, undefined, createBffTransport(config, 'web', 'user'));
}

export function Providers({ services, queryClient, children }: PropsWithChildren<ProvidersProps>) {
  const [appServices] = useState(() => services ?? webServices());
  const [client] = useState(() => queryClient ?? createQueryClient(appServices.config));
  return (
    <AppServicesProvider services={appServices}>
      <QueryClientProvider client={client}>
        <PublicConfigProvider>
          <ThemeFromConfig className="min-h-dvh bg-surface text-foreground">
            <ToastProvider>
              <SessionProvider>{children}</SessionProvider>
            </ToastProvider>
          </ThemeFromConfig>
        </PublicConfigProvider>
      </QueryClientProvider>
    </AppServicesProvider>
  );
}
