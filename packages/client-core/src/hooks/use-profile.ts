import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiErrorCode,
  isApiError,
  type BasicsChanges,
  type CareerPilotApi,
  type Contact,
  type ContactChanges,
  type ContactInput,
  type DocumentChanges,
  type DocumentInput,
  type Profile,
  type ProfileEntry,
  type UploadSource,
} from '@careerpilot/api-client';
import { moveItem, type EnumKey } from '@careerpilot/domain-ui-logic';
import type { EntryValue, SectionDefinition, ValidationContext } from '@careerpilot/dynamic-forms';
import { useEnumDisplay, usePublicConfig } from '../config/public-config';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';

type EntryValues = Record<string, EntryValue>;

const ERROR_KEYS: Record<string, string> = {
  file_type: 'validation.fileType',
  file_too_large: 'validation.fileTooLarge',
  file_empty: 'validation.fileEmpty',
  contact_exists: 'validation.duplicateContact',
  email: 'validation.email',
  phone: 'validation.phone',
  skills: 'validation.skillLimit',
};
const FALLBACK_ERROR_KEY = 'common.saveFailed';

export function profileErrorKey(error: unknown): string {
  if (isApiError(error) && (error.code === ApiErrorCode.Validation || error.code === ApiErrorCode.Conflict)) {
    return ERROR_KEYS[error.detail ?? ''] ?? FALLBACK_ERROR_KEY;
  }
  return FALLBACK_ERROR_KEY;
}

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => api.profile.getProfile() });
}

export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => a.position - b.position);
}

function useProfileMutation<TArgs>(run: (api: CareerPilotApi, args: TArgs) => Promise<Profile>) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => run(api, args),
    onSuccess: (profile) => client.setQueryData(queryKeys.profile, profile),
  });
}

function useOptimisticOrder<T extends { id: string }>(
  select: (profile: Profile) => T[],
  apply: (profile: Profile, items: T[]) => Profile,
  save: (api: CareerPilotApi, orderedIds: string[]) => Promise<Profile>,
) {
  const api = useApi();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (orderedIds: string[]) => save(api, orderedIds),
    onMutate: async (orderedIds) => {
      await client.cancelQueries({ queryKey: queryKeys.profile });
      const previous = client.getQueryData<Profile>(queryKeys.profile);
      if (previous) {
        const byId = new Map(select(previous).map((item) => [item.id, item]));
        const ordered = orderedIds.flatMap((id, index) => {
          const item = byId.get(id);
          return item ? [{ ...item, position: index + 1 }] : [];
        });
        client.setQueryData<Profile>(queryKeys.profile, apply(previous, ordered));
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
      mutation.mutate(moveItem(current ? select(current) : [], from, to).map((item) => item.id));
    },
  };
}

export function useUpdateBasics() {
  return useProfileMutation((api, changes: BasicsChanges) => api.profile.updateBasics(changes));
}

export function useSetPhoto() {
  return useProfileMutation((api, file: UploadSource) => api.profile.setPhoto(file));
}

export function useRemovePhoto() {
  return useProfileMutation((api, _: void) => api.profile.removePhoto());
}

export function useAddContact() {
  return useProfileMutation((api, input: ContactInput) => api.profile.addContact(input));
}

export function useUpdateContact() {
  return useProfileMutation((api, { id, changes }: { id: string; changes: ContactChanges }) => api.profile.updateContact(id, changes));
}

export function useRemoveContact() {
  return useProfileMutation((api, id: string) => api.profile.removeContact(id));
}

export function useRestoreContact() {
  return useProfileMutation((api, id: string) => api.profile.restoreContact(id));
}

export function useReorderContacts() {
  return useOptimisticOrder(
    (profile) => sortContacts(profile.contacts),
    (profile, contacts) => ({ ...profile, contacts }),
    (api, orderedIds) => api.profile.reorderContacts(orderedIds),
  );
}

export function useSetPrimaryContact() {
  return useProfileMutation((api, id: string) => api.profile.setPrimaryContact(id));
}

export function useSetSkills() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (skills: string[]) => api.profile.setSkills(skills),
    onMutate: async (skills) => {
      await client.cancelQueries({ queryKey: queryKeys.profile });
      const previous = client.getQueryData<Profile>(queryKeys.profile);
      if (previous) {
        client.setQueryData<Profile>(queryKeys.profile, { ...previous, skills });
      }
      return { previous };
    },
    onError: (_error, _skills, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.profile, context.previous);
      }
    },
    onSuccess: (profile) => client.setQueryData(queryKeys.profile, profile),
  });
}

export function sortEntries(entries: ProfileEntry[] | undefined): ProfileEntry[] {
  return [...(entries ?? [])].sort((a, b) => a.position - b.position);
}

export function useAddEntry(section: string) {
  return useProfileMutation((api, values: EntryValues) => api.profile.addEntry(section, values));
}

export function useUpdateEntry(section: string) {
  return useProfileMutation((api, { id, values }: { id: string; values: EntryValues }) => api.profile.updateEntry(section, id, values));
}

export function useRemoveEntry(section: string) {
  return useProfileMutation((api, id: string) => api.profile.removeEntry(section, id));
}

export function useRestoreEntry(section: string) {
  return useProfileMutation((api, id: string) => api.profile.restoreEntry(section, id));
}

export function useReorderEntries(section: string) {
  return useOptimisticOrder(
    (profile) => sortEntries(profile.sections[section]),
    (profile, entries) => ({ ...profile, sections: { ...profile.sections, [section]: entries } }),
    (api, orderedIds) => api.profile.reorderEntries(section, orderedIds),
  );
}

export function useUploadDocument() {
  return useProfileMutation((api, input: DocumentInput) => api.profile.uploadDocument(input));
}

export function useUploadDocumentVersion() {
  return useProfileMutation((api, { id, file }: { id: string; file: UploadSource }) => api.profile.uploadDocumentVersion(id, file));
}

export function useUpdateDocument() {
  return useProfileMutation((api, { id, changes }: { id: string; changes: DocumentChanges }) => api.profile.updateDocument(id, changes));
}

export function useRemoveDocument() {
  return useProfileMutation((api, id: string) => api.profile.removeDocument(id));
}

export function useRestoreDocument() {
  return useProfileMutation((api, id: string) => api.profile.restoreDocument(id));
}

export function useReorderDocuments() {
  return useOptimisticOrder(
    (profile) => [...profile.documents].sort((a, b) => a.position - b.position),
    (profile, documents) => ({ ...profile, documents }),
    (api, orderedIds) => api.profile.reorderDocuments(orderedIds),
  );
}

export function useProfileSettings() {
  const { config, enums } = usePublicConfig();
  const enumDisplay = useEnumDisplay();
  const { clock } = useServices();
  return useMemo(() => {
    const settings = config.profile;
    const optionsOf = (key: EnumKey) => enums.list(key).map((row) => row.value);
    return {
      settings,
      section: (key: string): SectionDefinition | undefined => settings.sections.find((s) => s.key === key),
      optionsOf,
      optionLabel: (key: EnumKey, value: string) => enumDisplay(key, value).label,
      validationContext: (): ValidationContext => ({ limits: settings.limits, now: clock.now(), optionsOf }),
    };
  }, [clock, config.profile, enumDisplay, enums]);
}

export const UploadRejection = {
  Type: 'type',
  Size: 'size',
  Empty: 'empty',
} as const;
export type UploadRejection = (typeof UploadRejection)[keyof typeof UploadRejection];

export const UPLOAD_REJECTION_KEYS: Record<UploadRejection, string> = {
  [UploadRejection.Type]: 'validation.fileType',
  [UploadRejection.Size]: 'validation.fileTooLarge',
  [UploadRejection.Empty]: 'validation.fileEmpty',
};

export function checkUpload(source: UploadSource, accept: readonly string[], maxBytes: number): UploadRejection | undefined {
  if (source.size <= 0) {
    return UploadRejection.Empty;
  }
  if (!accept.includes(source.type)) {
    return UploadRejection.Type;
  }
  return source.size > maxBytes ? UploadRejection.Size : undefined;
}
