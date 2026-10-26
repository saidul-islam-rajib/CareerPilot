import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { FileText, Upload } from '@/ui/icons';
import type { ProfileDocument } from '@careerpilot/api-client';
import {
  profileErrorKey,
  useEnumDisplay,
  useFormat,
  useProfileSettings,
  useRemoveDocument,
  useRestoreDocument,
  useT,
  useUpdateDocument,
  useUploadDocumentVersion,
} from '@careerpilot/client-core';
import { DocumentKind, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, ErrorState, ListRow, Screen, Section, Segmented, Text, TextField, TextVariant } from '@/ui';
import { ServerError, useLoadedProfile } from './profile-edit-screens';
import { pickDocument, useProfileFeedback, useRemoveWithUndo, useUploadRules } from './profile-support';

function DocumentForm({ document }: { document: ProfileDocument }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const feedback = useProfileFeedback();
  const removeWithUndo = useRemoveWithUndo();
  const rules = useUploadRules();
  const enumDisplay = useEnumDisplay();
  const { settings } = useProfileSettings();
  const update = useUpdateDocument();
  const uploadVersion = useUploadDocumentVersion();
  const remove = useRemoveDocument();
  const restore = useRestoreDocument();
  const [name, setName] = useState(document.name);
  const [kind, setKind] = useState<DocumentKind>(document.kind);
  const [error, setError] = useState<string>();

  const save = () => {
    if (!name.trim()) {
      setError('validation.required');
      return;
    }
    update.mutate(
      { id: document.id, changes: { name, kind } },
      {
        onSuccess: () => {
          feedback.saved();
          router.back();
        },
        onError: (failure) => setError(profileErrorKey(failure)),
      },
    );
  };

  const newVersion = async () => {
    const source = await pickDocument(rules.documents.accept);
    if (!source) {
      return;
    }
    const rejection = rules.documents.check(source);
    if (rejection) {
      feedback.rejected(rejection, rules.documents.params);
      return;
    }
    uploadVersion.mutate({ id: document.id, file: source }, { onSuccess: () => feedback.saved(t('profile.uploaded', { name: source.name })), onError: (failure) => feedback.failed(failure, rules.documents.params) });
  };

  const removeDocument = () => removeWithUndo(() => remove.mutateAsync(document.id), () => restore.mutateAsync(document.id), document.name, () => router.back());

  return (
    <Screen footer={<Button label={t('common.save')} onPress={save} loading={update.isPending} fullWidth />} testID="document-screen">
      <ServerError message={error === 'validation.required' ? undefined : error} />
      <TextField label={t('profile.documentName')} maxLength={settings.limits.documentNameMaxLength} value={name} onChangeText={setName} error={error === 'validation.required' ? error : undefined} />
      <View style={{ gap: theme.space.xs }}>
        <Text variant={TextVariant.Label}>{t('profile.documentKind')}</Text>
        <Segmented
          accessibilityLabel={t('profile.documentKind')}
          value={kind}
          onChange={setKind}
          options={enumValues(DocumentKind).map((value) => ({ value, label: enumDisplay(EnumKey.DocumentKind, value).label }))}
        />
      </View>
      <Section title={t('profile.versions')}>
        <Card padded={false}>
          {document.versions.map((version) => (
            <ListRow
              key={version.version}
              icon={FileText}
              title={t('profile.versionUploaded', { version: version.version, date: format.date(version.uploadedAt) })}
              subtitle={[version.fileName, format.fileSize(version.sizeBytes)].filter(Boolean).join(' · ')}
              onPress={() => void WebBrowser.openBrowserAsync(version.url)}
            />
          ))}
        </Card>
      </Section>
      <Button label={t('profile.newVersion')} icon={Upload} variant={ButtonVariant.Outline} onPress={() => void newVersion()} loading={uploadVersion.isPending} />
      <Button label={t('profile.removeDocument')} variant={ButtonVariant.Destructive} onPress={removeDocument} loading={remove.isPending} />
    </Screen>
  );
}

export function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return useLoadedProfile((profile) => {
    const document = profile.documents.find((d) => d.id === id);
    return document ? <DocumentForm document={document} /> : <ErrorState />;
  });
}
