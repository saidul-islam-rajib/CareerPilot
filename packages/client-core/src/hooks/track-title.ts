import type { Translate } from '@careerpilot/i18n';
import type { Track } from '@careerpilot/api-client';

const HOME_COUNTRY_KINDS: readonly string[] = ['bangladesh_onsite', 'bangladesh_government'];
const REGION = 'region';

export function countryName(code: string, locale: string): string {
  if (!code) {
    return '';
  }
  try {
    return new Intl.DisplayNames([locale], { type: REGION }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function trackTitle(track: Track, t: Translate, homeCountry?: string, locale = 'en'): string {
  if (track.name) {
    return track.name;
  }
  if (homeCountry && HOME_COUNTRY_KINDS.includes(track.kind)) {
    return t(`tracks.home.${track.kind}`, { country: countryName(homeCountry, locale) });
  }
  return t(`tracks.${track.kind}`);
}
