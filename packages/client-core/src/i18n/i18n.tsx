import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { Locale, catalogs, createTranslator, type Translate } from '@careerpilot/i18n';

const fallbackTranslate = createTranslator(catalogs.en);

const I18nContext = createContext<Translate>(fallbackTranslate);

function resolveLocale(locale: string): Locale {
  return (Object.values(Locale) as string[]).includes(locale) ? (locale as Locale) : Locale.English;
}

export function I18nProvider({ locale, children }: PropsWithChildren<{ locale: string }>) {
  const translate = useMemo(() => createTranslator(catalogs[resolveLocale(locale)], catalogs.en), [locale]);
  return <I18nContext.Provider value={translate}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return useContext(I18nContext);
}
