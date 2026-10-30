import * as DocumentPicker from 'expo-document-picker';
import { File as LocalFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Award, Briefcase, ClipboardCheck, FileText, FolderGit2, GraduationCap, IdCard, Languages, Link, MapPin, School, ShieldCheck, Trophy, Users, type LucideIcon } from '@/ui/icons';
import type { UploadSource } from '@careerpilot/api-client';
import { UPLOAD_REJECTION_KEYS, checkUpload, profileErrorKey, useFormat, useProfileSettings, useT } from '@careerpilot/client-core';
import { SnackbarTone, useSnackbar } from '@/ui/snackbar';

const SECTION_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  languages: Languages,
  'clipboard-check': ClipboardCheck,
  award: Award,
  'folder-git-2': FolderGit2,
  link: Link,
  trophy: Trophy,
  users: Users,
  'id-card': IdCard,
  school: School,
  'map-pin': MapPin,
  'shield-check': ShieldCheck,
};

const PHOTO_ASPECT: [number, number] = [1, 1];

export function sectionIcon(name: string): LucideIcon {
  return SECTION_ICONS[name] ?? FileText;
}

interface PickedAsset {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
  file?: File;
}

export function toUploadSource(asset: PickedAsset): UploadSource {
  return {
    name: asset.name ?? asset.uri.split('/').pop() ?? '',
    type: asset.mimeType ?? asset.file?.type ?? '',
    size: asset.size ?? asset.file?.size ?? 0,
    uri: asset.uri,
    blob: asset.file,
    bytes: asset.file ? undefined : () => new LocalFile(asset.uri).bytes(),
  };
}

export async function pickDocument(accept: string[]): Promise<UploadSource | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: accept, copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? undefined : result.assets?.[0];
  return asset ? toUploadSource(asset) : undefined;
}

export async function pickPhoto(): Promise<UploadSource | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: PHOTO_ASPECT, quality: 1 });
  const asset = result.canceled ? undefined : result.assets?.[0];
  return asset ? toUploadSource({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, size: asset.fileSize, file: asset.file }) : undefined;
}

export function useProfileFeedback() {
  const t = useT();
  const snackbar = useSnackbar();
  return {
    saved: (message?: string) => snackbar.show({ message: message ?? t('common.saved') }),
    failed: (error: unknown, params?: Record<string, string | number>) => snackbar.show({ message: t(profileErrorKey(error), params), tone: SnackbarTone.Danger }),
    rejected: (key: string, params?: Record<string, string | number>) => snackbar.show({ message: t(key, params), tone: SnackbarTone.Danger }),
    removed: (item: string, undo: () => void) => snackbar.show({ message: t('common.removed', { item }), actionLabel: t('common.undo'), onAction: undo }),
  };
}

export function useUploadRules() {
  const t = useT();
  const format = useFormat();
  const { settings } = useProfileSettings();
  const typesLabel = (types: string[]) => types.map((type) => t(`common.fileTypes.${type}`)).join(t('common.listSeparator'));
  const rule = (accept: string[], maxBytes: number) => ({
    accept,
    maxBytes,
    params: { types: typesLabel(accept), size: format.fileSize(maxBytes) },
    check: (source: UploadSource) => {
      const rejection = checkUpload(source, accept, maxBytes);
      return rejection ? UPLOAD_REJECTION_KEYS[rejection] : undefined;
    },
  });
  return {
    documents: rule(settings.uploads.documentTypes, settings.uploads.maxDocumentBytes),
    photos: rule(settings.uploads.photoTypes, settings.uploads.maxPhotoBytes),
  };
}

export function useRemoveWithUndo() {
  const feedback = useProfileFeedback();
  return (remove: () => Promise<unknown>, restore: () => Promise<unknown>, label: string, after?: () => void) =>
    void remove().then(
      () => {
        feedback.removed(label, () => void restore().catch((error: unknown) => feedback.failed(error)));
        after?.();
      },
      (error: unknown) => feedback.failed(error),
    );
}
