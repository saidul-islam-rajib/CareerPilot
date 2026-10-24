'use client';

import { useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { AppServicesProvider, PublicConfigProvider, createQueryClient } from '@careerpilot/client-core';
import { themes } from '@careerpilot/ui-tokens';
import { ThemeScope } from '@careerpilot/ui-web';
import { getAdminConfig } from './admin-config';
import { AdminServicesProvider, createAdminServices, type AdminServices } from './admin-services';
import { AdminSessionProvider } from './admin-session';
import { sessionStore } from './session-store';

export interface ProvidersProps {
  services?: AdminServices;
  queryClient?: QueryClient;
}

export function Providers({ services, queryClient, children }: PropsWithChildren<ProvidersProps>) {
  const [adminServices] = useState(() => services ?? createAdminServices(getAdminConfig(), sessionStore));
  const [client] = useState(() => queryClient ?? createQueryClient(adminServices.config));
  return (
    <AppServicesProvider services={adminServices.userServices}>
      <QueryClientProvider client={client}>
        <PublicConfigProvider>
          <ThemeScope theme={themes[adminServices.config.ui.adminTheme]} className="min-h-dvh bg-surface text-foreground">
            <AdminServicesProvider services={adminServices}>
              <AdminSessionProvider>{children}</AdminSessionProvider>
            </AdminServicesProvider>
          </ThemeScope>
        </PublicConfigProvider>
      </QueryClientProvider>
    </AppServicesProvider>
  );
}
