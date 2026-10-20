import { useState, type PropsWithChildren } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { PublicConfigProvider } from '../config/public-config';
import { createQueryClient } from '../query/query-client';
import { AppServicesProvider, type AppServices } from '../services/app-services';
import { SessionProvider } from '../session/session';

export interface AppProvidersProps {
  services: AppServices;
  queryClient?: QueryClient;
  safeAreaMetrics?: Metrics;
}

export function AppProviders({ services, queryClient, safeAreaMetrics, children }: PropsWithChildren<AppProvidersProps>) {
  const [client] = useState(() => queryClient ?? createQueryClient(services.config));
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <AppServicesProvider services={services}>
          <QueryClientProvider client={client}>
            <PublicConfigProvider>
              <SessionProvider>{children}</SessionProvider>
            </PublicConfigProvider>
          </QueryClientProvider>
        </AppServicesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
