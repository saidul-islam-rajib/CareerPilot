import type { Translate } from '@careerpilot/i18n';
import type { Track } from '@careerpilot/api-client';

export function trackTitle(track: Track, t: Translate): string {
  return track.name ?? t(`tracks.${track.kind}`);
}
