'use client';

import { useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { AppServicesProvider, PublicConfigProvider, SessionProvider, createAppServices, createQueryClient, type AppServices } from '@careerpilot/client-core';
import { ThemeFromConfig } from '@careerpilot/ui-web';
import { sessionStore } from './session-store';
import { getWebConfig } from './web-config';

export interface ProvidersProps {
  services?: AppServices;
  queryClient?: QueryClient;
}

export function Providers({ services, queryClient, children }: PropsWithChildren<ProvidersProps>) {
  const [appServices] = useState(() => services ?? createAppServices(getWebConfig(), sessionStore));
  const [client] = useState(() => queryClient ?? createQueryClient(appServices.config));
  return (
    <AppServicesProvider services={appServices}>
      <QueryClientProvider client={client}>
        <PublicConfigProvider>
          <ThemeFromConfig className="min-h-dvh bg-surface text-foreground">
            <SessionProvider>{children}</SessionProvider>
          </ThemeFromConfig>
        </PublicConfigProvider>
      </QueryClientProvider>
    </AppServicesProvider>
  );
}
