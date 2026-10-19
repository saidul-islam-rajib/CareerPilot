import en from './locales/en.json';
import type { Catalog } from './translator';

export * from './translator';

export const Locale = {
  English: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const catalogs: Readonly<Record<Locale, Catalog>> = {
  en,
};
