'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import type { ProfileDocument } from '@careerpilot/api-client';
import {
  profileErrorKey,
  useEnumDisplay,
  useFormat,
  useProfileSettings,
  useRemoveDocument,
  useReorderDocuments,
  useRestoreDocument,
  useT,
  useUpdateDocument,
  useUploadDocument,
  useUploadDocumentVersion,
} from '@careerpilot/client-core';
import { DocumentKind, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import { Button, Card, DocumentViewer, EnumBadge, FileDropZone, FormDialog, OverflowMenu, SelectField, SortableList, TextField, checkFile } from '@careerpilot/ui-web';
import { sectionAnchor, uploadSource, useProfileFeedback, useUploadRules } from './profile-support';

function DocumentDialog({ document, open, onOpenChange }: { document: ProfileDocument; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const format = useFormat();
  const feedback = useProfileFeedback();
  const enumDisplay = useEnumDisplay();
  const { settings } = useProfileSettings();
  const update = useUpdateDocument();
  const [name, setName] = useState(document.name);
  const [kind, setKind] = useState<DocumentKind>(document.kind);
  const [error, setError] = useState<string>();
  const submit = () => {
    if (!name.trim()) {
      setError('validation.required');
      return;
    }
    update.mutate(
      { id: document.id, changes: { name, kind } },
      {
        onSuccess: () => {
          onOpenChange(false);
          feedback.saved();
        },
        onError: (failure) => setError(profileErrorKey(failure)),
      },
    );
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('profile.renameDocument')} submitLabel={t('common.save')} submitting={update.isPending} onSubmit={submit}>
      <TextField label={t('profile.documentName')} value={name} maxLength={settings.limits.documentNameMaxLength} error={error} onChange={(e) => setName(e.target.value)} required />
      <SelectField
        label={t('profile.documentKind')}
        value={kind}
        options={enumValues(DocumentKind).map((value) => ({ value, label: enumDisplay(EnumKey.DocumentKind, value).label }))}
        onValueChange={(value) => setKind(value as DocumentKind)}
      />
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t('profile.versions')}</h3>
        <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
          {document.versions.map((version) => (
            <li key={version.version} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">
                {t('profile.versionUploaded', { version: version.version, date: format.date(version.uploadedAt) })}
                <span className="block text-xs text-muted">
                  {version.fileName} · {format.fileSize(version.sizeBytes)}
                </span>
              </span>
              <DocumentViewer url={version.url} title={document.name} subtitle={t('profile.version', { version: version.version })} trigger={<Button variant="ghost" size="sm" icon={Eye}>{t('profile.viewDocument')}</Button>} />
            </li>
          ))}
        </ul>
      </div>
    </FormDialog>
  );
}

function DocumentRow({ document, index, count, onEdit }: { document: ProfileDocument; index: number; count: number; onEdit: () => void }) {
  const t = useT();
  const format = useFormat();
  const feedback = useProfileFeedback();
  const rules = useUploadRules();
  const remove = useRemoveDocument();
  const restore = useRestoreDocument();
  const reorder = useReorderDocuments();
  const uploadVersion = useUploadDocumentVersion();
  const picker = useRef<HTMLInputElement>(null);

  const onVersion = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const rejection = checkFile(file, rules.documents.accept, rules.documents.maxBytes);
    if (rejection) {
      feedback.rejected(rules.rejectionKey(rejection), rules.documents.params);
      return;
    }
    uploadVersion.mutate(
      { id: document.id, file: uploadSource(file) },
      { onSuccess: () => feedback.saved(t('profile.uploaded', { name: file.name })), onError: (error) => feedback.failed(error, rules.documents.params) },
    );
  };

  const removeDocument = () =>
    remove.mutate(document.id, {
      onSuccess: () => feedback.removed(document.name, () => restore.mutate(document.id, { onError: (error) => feedback.failed(error) })),
      onError: (error) => feedback.failed(error),
    });

  return (
    <div className="flex items-center gap-3 py-2">
      <FileText className="size-6 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{document.name}</span>
          <EnumBadge enumKey={EnumKey.DocumentKind} value={document.kind} />
        </div>
        <span className="text-xs text-muted">
          {t('profile.version', { version: document.version })} · {format.fileSize(document.file.sizeBytes)} · {t('common.updatedAt', { date: format.date(document.updatedAt) })}
        </span>
      </div>
      <DocumentViewer
        url={document.file.url}
        title={document.name}
        subtitle={t('profile.version', { version: document.version })}
        trigger={
          <Button variant="outline" size="sm" icon={Eye} aria-label={`${t('profile.viewDocument')}: ${document.name}`}>
            <span className="hidden sm:inline">{t('profile.viewDocument')}</span>
          </Button>
        }
      />
      <input ref={picker} type="file" accept={rules.documents.accept.join(',')} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
        onVersion(e.target.files?.[0]);
        e.target.value = '';
      }} />
      <OverflowMenu
        label={t('common.moreActions', { item: document.name })}
        items={[
          { label: t('profile.newVersion'), icon: Upload, onSelect: () => picker.current?.click() },
          { label: t('profile.renameDocument'), icon: Pencil, onSelect: onEdit },
          { label: t('common.moveUp'), icon: ArrowUp, onSelect: () => reorder.move(index, index - 1), disabled: index === 0 },
          { label: t('common.moveDown'), icon: ArrowDown, onSelect: () => reorder.move(index, index + 1), disabled: index === count - 1 },
          { label: t('profile.removeDocument'), icon: Trash2, onSelect: removeDocument, destructive: true },
        ]}
      />
    </div>
  );
}

export function DocumentsSection({ documents }: { documents: ProfileDocument[] }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const rules = useUploadRules();
  const upload = useUploadDocument();
  const reorder = useReorderDocuments();
  const [editing, setEditing] = useState<{ document?: ProfileDocument; version: number }>({ version: 0 });
  const [uploadingName, setUploadingName] = useState<string>();
  const sorted = [...documents].sort((a, b) => a.position - b.position);

  const onFile = (file: File) => {
    setUploadingName(file.name);
    upload.mutate(
      { file: uploadSource(file), kind: DocumentKind.Cv },
      {
        onSuccess: () => feedback.saved(t('profile.uploaded', { name: file.name })),
        onError: (error) => feedback.failed(error, rules.documents.params),
        onSettled: () => setUploadingName(undefined),
      },
    );
  };

  return (
    <section id={sectionAnchor('documents')} aria-labelledby="profile-documents-title" className="scroll-mt-24">
      <Card className="gap-3">
        <div className="flex items-center gap-3">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 id="profile-documents-title" className="text-lg font-semibold">
            {t('profile.documents')}
          </h2>
        </div>
        {sorted.length === 0 ? <p className="text-sm text-muted">{t('profile.documentsEmpty')}</p> : null}
        {sorted.length > 0 ? (
          <div className="divide-y divide-border">
            <SortableList
              items={sorted}
              keyOf={(d) => d.id}
              labelOf={(d) => d.name}
              onReorder={reorder.move}
              moveButtons={false}
              renderItem={(document) => (
                <DocumentRow document={document} index={sorted.indexOf(document)} count={sorted.length} onEdit={() => setEditing((c) => ({ document, version: c.version + 1 }))} />
              )}
            />
          </div>
        ) : null}
        <FileDropZone
          label={t('profile.dropDocument')}
          hint={t('profile.documentHint', { size: rules.documents.params.size })}
          accept={rules.documents.accept}
          maxBytes={rules.documents.maxBytes}
          busy={upload.isPending}
          busyLabel={uploadingName ? t('profile.uploading', { name: uploadingName }) : undefined}
          compact={sorted.length > 0}
          onFile={onFile}
          onReject={(reason) => feedback.rejected(rules.rejectionKey(reason), rules.documents.params)}
        />
      </Card>
      {editing.document ? (
        <DocumentDialog
          key={editing.version}
          document={editing.document}
          open={Boolean(editing.document)}
          onOpenChange={(open) => setEditing((c) => (open ? c : { version: c.version }))}
        />
      ) : null}
    </section>
  );
}
