import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PublicConfig } from '@careerpilot/api-client';
import { StatusTone, createEnumMetadataIndex, type EnumKey, type EnumMetadataIndex } from '@careerpilot/domain-ui-logic';
import { resolveTheme } from '@careerpilot/ui-tokens';
import { I18nProvider, useT } from '../i18n/i18n';
import { queryKeys } from '../query/query-keys';
import { useServices } from '../services/app-services';
import { ThemeProvider } from '../theme/theme';
import { publicConfigFromDefaults } from './app-config';

interface PublicConfigValue {
  config: PublicConfig;
  enums: EnumMetadataIndex;
}

const PublicConfigContext = createContext<PublicConfigValue | undefined>(undefined);

export function PublicConfigProvider({ children }: PropsWithChildren) {
  const { api, config: appConfig } = useServices();
  const defaults = useMemo(() => publicConfigFromDefaults(appConfig), [appConfig]);
  const query = useQuery({
    queryKey: queryKeys.config,
    queryFn: () => api.config.getPublicConfig(),
    placeholderData: defaults,
  });
  const config = query.data ?? defaults;
  const value = useMemo(() => ({ config, enums: createEnumMetadataIndex(config.enumValues) }), [config]);
  const theme = resolveTheme(config.theme, appConfig.ui.activeTheme);
  return (
    <PublicConfigContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <I18nProvider locale={config.locale}>{children}</I18nProvider>
      </ThemeProvider>
    </PublicConfigContext.Provider>
  );
}

export function usePublicConfig(): PublicConfigValue {
  const value = useContext(PublicConfigContext);
  if (!value) {
    throw new Error('PublicConfigProvider is missing');
  }
  return value;
}

export interface EnumDisplay {
  label: string;
  tone: StatusTone;
}

export function useEnumDisplay(): (enumKey: EnumKey, value: string) => EnumDisplay {
  const { enums } = usePublicConfig();
  const t = useT();
  return (enumKey, value) => {
    const meta = enums.get(enumKey, value);
    return { label: t(meta?.labelKey ?? `enums.${enumKey}.${value}`), tone: meta?.tone ?? StatusTone.Neutral };
  };
}
