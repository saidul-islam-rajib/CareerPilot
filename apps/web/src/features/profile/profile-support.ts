import {
  Award,
  Briefcase,
  ClipboardCheck,
  FileText,
  FolderGit2,
  GraduationCap,
  Languages,
  Link,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UploadSource } from '@careerpilot/api-client';
import { profileErrorKey, useFormat, useProfileSettings, useT } from '@careerpilot/client-core';
import { FileRejection, ToastTone, useToast } from '@careerpilot/ui-web';

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
};

export function sectionIcon(name: string): LucideIcon {
  return SECTION_ICONS[name] ?? FileText;
}

export function uploadSource(file: File): UploadSource {
  return { name: file.name, type: file.type, size: file.size, blob: file };
}

export function sectionAnchor(key: string): string {
  return `profile-${key}`;
}

const REJECTION_KEYS: Record<FileRejection, string> = {
  [FileRejection.Type]: 'validation.fileType',
  [FileRejection.Size]: 'validation.fileTooLarge',
  [FileRejection.Empty]: 'validation.fileEmpty',
};

export function useUploadRules() {
  const t = useT();
  const format = useFormat();
  const { settings } = useProfileSettings();
  const typesLabel = (types: string[]) => types.map((type) => t(`common.fileTypes.${type}`)).join(t('common.listSeparator'));
  return {
    documents: {
      accept: settings.uploads.documentTypes,
      maxBytes: settings.uploads.maxDocumentBytes,
      params: { types: typesLabel(settings.uploads.documentTypes), size: format.fileSize(settings.uploads.maxDocumentBytes) },
    },
    photos: {
      accept: settings.uploads.photoTypes,
      maxBytes: settings.uploads.maxPhotoBytes,
      params: { types: typesLabel(settings.uploads.photoTypes), size: format.fileSize(settings.uploads.maxPhotoBytes) },
    },
    rejectionKey: (reason: FileRejection) => REJECTION_KEYS[reason],
  };
}

export function useProfileFeedback() {
  const t = useT();
  const toast = useToast();
  return {
    saved: (message?: string) => toast.show({ message: message ?? t('common.saved') }),
    failed: (error: unknown, params?: Record<string, string | number>) => toast.show({ message: t(profileErrorKey(error), params), tone: ToastTone.Danger }),
    rejected: (key: string, params?: Record<string, string | number>) => toast.show({ message: t(key, params), tone: ToastTone.Danger }),
    removed: (item: string, undo: () => void) => toast.show({ message: t('common.removed', { item }), actionLabel: t('common.undo'), onAction: undo }),
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
