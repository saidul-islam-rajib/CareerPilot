import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contact, Profile } from '@careerpilot/api-client';
import { moveItem } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '@/core/query/query-keys';
import { useApi } from '@/core/services/app-services';

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => api.profile.getProfile() });
}

export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => a.position - b.position);
}

export function useReorderContacts() {
  const api = useApi();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.profile.reorderContacts(orderedIds),
    onMutate: async (orderedIds) => {
      await client.cancelQueries({ queryKey: queryKeys.profile });
      const previous = client.getQueryData<Profile>(queryKeys.profile);
      if (previous) {
        const byId = new Map(previous.contacts.map((c) => [c.id, c]));
        const contacts = orderedIds.flatMap((id, index) => {
          const contact = byId.get(id);
          return contact ? [{ ...contact, position: index + 1 }] : [];
        });
        client.setQueryData<Profile>(queryKeys.profile, { ...previous, contacts });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.profile, context.previous);
      }
    },
    onSuccess: (profile) => client.setQueryData(queryKeys.profile, profile),
  });
  return {
    ...mutation,
    move: (from: number, to: number) => {
      const current = client.getQueryData<Profile>(queryKeys.profile);
      mutation.mutate(moveItem(sortContacts(current?.contacts ?? []), from, to).map((c) => c.id));
    },
  };
}

export function useSetPrimaryContact() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.profile.setPrimaryContact(id),
    onSuccess: (profile) => client.setQueryData(queryKeys.profile, profile),
  });
}
