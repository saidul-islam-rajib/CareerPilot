import { useState, type PropsWithChildren } from 'react';
import { type AppServices, AppServicesProvider, PublicConfigProvider, SessionProvider, createQueryClient } from '@careerpilot/client-core';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ThemeFromConfig } from '../theme/theme';

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
              <ThemeFromConfig>
                <SessionProvider>{children}</SessionProvider>
              </ThemeFromConfig>
            </PublicConfigProvider>
          </QueryClientProvider>
        </AppServicesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
