import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences, PasswordChange, PauseOption, Settings, SubmissionWindow, Track, TrackUpdate } from '@careerpilot/api-client';
import type { ApplicationMode } from '@careerpilot/domain-ui-logic';
import { usePublicConfig } from '../config/public-config';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';

export function useSettings() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api.settings.getSettings() });
}

function useSettingsMutation<TArgs>(run: (args: TArgs) => Promise<Settings>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async (settings) => {
      client.setQueryData(queryKeys.settings, settings);
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function usePause() {
  const api = useApi();
  return {
    pause: useSettingsMutation((option: PauseOption) => api.settings.pause(option)),
    resume: useSettingsMutation(() => api.settings.resume()),
  };
}

export function useUpdateNotifications() {
  const api = useApi();
  return useSettingsMutation((changes: Partial<NotificationPreferences>) => api.settings.updateNotifications(changes));
}

export function useChangePassword() {
  const api = useApi();
  return useMutation({ mutationFn: (change: PasswordChange) => api.settings.changePassword(change) });
}

export function useUpdateWindow() {
  const api = useApi();
  return useSettingsMutation((window: SubmissionWindow) => api.settings.updateSubmissionWindow(window));
}

export function useUpdateTrack() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: TrackUpdate }) => api.settings.updateTrack(id, update),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: queryKeys.settings }), client.invalidateQueries({ queryKey: queryKeys.dashboard })]);
    },
  });
}

export function useSignInActivity() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.signInActivity, queryFn: () => api.settings.listSignInActivity() });
}

export function useAccountDeletion() {
  const api = useApi();
  return useMutation({ mutationFn: () => api.settings.requestAccountDeletion() });
}

export function clampCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function useTrackEditor(track: Track) {
  const update = useUpdateTrack();
  const { config } = usePublicConfig();
  const services = useServices();
  const bounds = config.validationPolicy.track;
  const [count, setCount] = useState(track.resultCount);
  const [mode, setMode] = useState(track.mode);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (pending.current === undefined && !update.isPending) {
      setCount(track.resultCount);
      setMode(track.mode);
    }
  }, [track.resultCount, track.mode, update.isPending]);

  useEffect(() => () => clearTimeout(pending.current), []);

  const changeCount = (next: number) => {
    const value = clampCount(next, bounds.minResultCount, bounds.maxResultCount);
    setCount(value);
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = undefined;
      if (value !== track.resultCount) {
        update.mutate({ id: track.id, update: { resultCount: value } });
      }
    }, services.config.ui.saveDelayMs);
  };

  const changeMode = (next: ApplicationMode) => {
    setMode(next);
    update.mutate({ id: track.id, update: { mode: next } });
  };

  return { count, mode, min: bounds.minResultCount, max: bounds.maxResultCount, changeCount, changeMode, saving: update.isPending, failed: update.isError };
}
