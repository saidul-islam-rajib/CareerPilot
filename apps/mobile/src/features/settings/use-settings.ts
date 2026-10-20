import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PauseOption, Settings, SubmissionWindow, TrackUpdate } from '@careerpilot/api-client';
import { queryKeys } from '@/core/query/query-keys';
import { useApi } from '@/core/services/app-services';

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
