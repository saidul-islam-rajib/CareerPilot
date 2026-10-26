import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { BadgeCheck, Camera, ChevronRight, Crop, FileText, Mail, MapPin, Pencil, Phone, Plus, Sparkles, Trash2, Upload, UserRound, type LucideIcon } from 'lucide-react-native';
import type { Contact, Profile, ProfileDocument, ProfileEntry } from '@careerpilot/api-client';
import {
  sortContacts,
  sortEntries,
  useFormat,
  useProfile,
  useProfileSettings,
  useRemovePhoto,
  useReorderContacts,
  useReorderDocuments,
  useReorderEntries,
  useSetPhoto,
  useT,
  useUploadDocument,
} from '@careerpilot/client-core';
import { ContactKind, DocumentKind, EnumKey, ProfileBlock, StatusTone, isEnumValue } from '@careerpilot/domain-ui-logic';
import { describeEntry, type SectionDefinition } from '@careerpilot/dynamic-forms';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import {
  Avatar,
  Badge,
  Button,
  ButtonVariant,
  Card,
  EnumBadge,
  ErrorState,
  Icon,
  IconSize,
  LoadingState,
  ProgressBar,
  Row,
  Screen,
  SortableList,
  Text,
  TextTone,
  TextVariant,
} from '@/ui';
import { pickDocument, pickPhoto, sectionIcon, useProfileFeedback, useUploadRules } from './profile-support';

const PERCENT = 100;

function BlockCard({ icon, title, action, children }: { icon: LucideIcon; title: string; action?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Icon icon={icon} color={theme.colors.primary} />
        <Text variant={TextVariant.Subheading} accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </Card>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button label={label} icon={Plus} variant={ButtonVariant.Secondary} onPress={onPress} />;
}

function ContactRow({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.edit')}: ${contact.value}`} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingVertical: theme.space.sm }}>
      <Icon icon={contact.kind === ContactKind.Email ? Mail : Phone} color={theme.colors.primary} />
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <Text variant={TextVariant.Subheading} numberOfLines={1}>
          {contact.value}
        </Text>
        <Row gap={theme.space.xs} wrap>
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {contact.label}
          </Text>
          {contact.verified ? <Icon icon={BadgeCheck} size={IconSize.Small} color={theme.colors.success} /> : null}
          {contact.isPrimary ? <Badge label={t('common.primary')} tone={StatusTone.Primary} /> : null}
        </Row>
      </View>
    </Pressable>
  );
}

function EntryRow({ section, entry, onPress }: { section: SectionDefinition; entry: ProfileEntry; onPress: () => void }) {
  const theme = useTheme();
  const format = useFormat();
  const { optionLabel } = useProfileSettings();
  const display = describeEntry(section, entry.values, optionLabel);
  const meta = [...display.subtitle, display.period ? format.period(display.period) : undefined].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={display.title} onPress={onPress} style={{ gap: theme.space.xxs, paddingVertical: theme.space.sm }}>
      <Text variant={TextVariant.Subheading}>{display.title}</Text>
      {meta ? (
        <Text variant={TextVariant.Label} tone={TextTone.Muted}>
          {meta}
        </Text>
      ) : null}
      {display.body ? <Text numberOfLines={3}>{display.body}</Text> : null}
    </Pressable>
  );
}

function SectionBlock({ section, entries }: { section: SectionDefinition; entries: ProfileEntry[] | undefined }) {
  const t = useT();
  const router = useRouter();
  const { optionLabel } = useProfileSettings();
  const reorder = useReorderEntries(section.key);
  const sorted = sortEntries(entries);
  return (
    <BlockCard icon={sectionIcon(section.icon)} title={t(`profile.sections.${section.key}.title`)} action={<AddButton label={t('common.add')} onPress={() => router.push(Routes.editEntry(section.key))} />}>
      {sorted.length === 0 ? (
        <Text tone={TextTone.Muted}>{t(`profile.sections.${section.key}.empty`)}</Text>
      ) : (
        <SortableList
          items={sorted}
          keyOf={(e) => e.id}
          labelOf={(e) => describeEntry(section, e.values, optionLabel).title}
          onReorder={reorder.move}
          renderItem={(entry) => <EntryRow section={section} entry={entry} onPress={() => router.push(Routes.editEntry(section.key, entry.id))} />}
        />
      )}
    </BlockCard>
  );
}

function DocumentRow({ document, onPress }: { document: ProfileDocument; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={document.name} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingVertical: theme.space.sm }}>
      <Icon icon={FileText} color={theme.colors.primary} />
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <Row gap={theme.space.xs} wrap>
          <Text variant={TextVariant.Subheading} numberOfLines={1}>
            {document.name}
          </Text>
          <EnumBadge enumKey={EnumKey.DocumentKind} value={document.kind} />
        </Row>
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {[t('profile.version', { version: document.version }), format.fileSize(document.file.sizeBytes), t('common.updatedAt', { date: format.date(document.updatedAt) })].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Icon icon={ChevronRight} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function useUploadNewDocument() {
  const t = useT();
  const feedback = useProfileFeedback();
  const rules = useUploadRules();
  const upload = useUploadDocument();
  const start = async () => {
    const source = await pickDocument(rules.documents.accept);
    if (!source) {
      return;
    }
    const rejection = rules.documents.check(source);
    if (rejection) {
      feedback.rejected(rejection, rules.documents.params);
      return;
    }
    upload.mutate({ file: source, kind: DocumentKind.Cv }, { onSuccess: () => feedback.saved(t('profile.uploaded', { name: source.name })), onError: (failure) => feedback.failed(failure, rules.documents.params) });
  };
  return { start, isPending: upload.isPending };
}

function useChangePhoto() {
  const router = useRouter();
  const feedback = useProfileFeedback();
  const rules = useUploadRules();
  const setPhoto = useSetPhoto();
  const start = async () => {
    const source = await pickPhoto();
    if (!source) {
      return;
    }
    const rejection = rules.photos.check(source);
    if (rejection) {
      feedback.rejected(rejection, rules.photos.params);
      return;
    }
    setPhoto.mutate(source, { onSuccess: () => router.push(Routes.photoCrop), onError: (failure) => feedback.failed(failure, rules.photos.params) });
  };
  return { start, isPending: setPhoto.isPending };
}

function Header({ profile, onNext }: { profile: Profile; onNext: (key: string) => void }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const changePhoto = useChangePhoto();
  const removePhoto = useRemovePhoto();
  const next = [...profile.completenessItems].filter((item) => !item.done).sort((a, b) => b.weight - a.weight)[0];
  const avatarSize = theme.space.xxxl * 2;
  return (
    <Card>
      <View style={{ alignItems: 'center', gap: theme.space.sm }}>
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={`${t('profile.photo')}. ${t('profile.tapToZoom')}`}
          disabled={!profile.photoUrl}
          onPress={() => profile.photoUrl && router.push(Routes.viewer(profile.photoUrl, t('profile.photo')))}
        >
          <Avatar name={profile.fullName} uri={profile.photoUrl} crop={profile.photoCrop} size={avatarSize} />
        </Pressable>
        <Row gap={theme.space.xs} wrap>
          <Button label={t(profile.photoUrl ? 'profile.changePhoto' : 'profile.addPhoto')} icon={Camera} variant={ButtonVariant.Ghost} onPress={() => void changePhoto.start()} loading={changePhoto.isPending} />
          {profile.photoUrl ? <Button label={t('profile.adjustPhoto')} icon={Crop} variant={ButtonVariant.Ghost} onPress={() => router.push(Routes.photoCrop)} /> : null}
          {profile.photoUrl ? (
            <Button label={t('profile.removePhoto')} icon={Trash2} variant={ButtonVariant.Ghost} onPress={() => removePhoto.mutate(undefined, { onError: (failure) => feedback.failed(failure) })} />
          ) : null}
        </Row>
        <Text variant={TextVariant.Title} align="center">
          {profile.fullName}
        </Text>
        <Text tone={profile.headline ? TextTone.Default : TextTone.Muted} align="center">
          {profile.headline || t('profile.noHeadline')}
        </Text>
        {profile.location ? (
          <Row gap={theme.space.xxs}>
            <Icon icon={MapPin} size={IconSize.Small} color={theme.colors.textMuted} />
            <Text variant={TextVariant.Label} tone={TextTone.Muted}>
              {profile.location}
            </Text>
          </Row>
        ) : null}
        <Button label={t('profile.editBasics')} icon={Pencil} variant={ButtonVariant.Outline} onPress={() => router.push(Routes.editBasics)} />
      </View>
      <ProgressBar value={profile.completeness / PERCENT} label={t('profile.completeness', { percent: profile.completeness })} />
      {next ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onNext(next.key)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, backgroundColor: theme.colors.primarySubtle, borderRadius: theme.radius.control, padding: theme.space.md }}
        >
          <Text variant={TextVariant.Label} style={{ flex: 1, color: theme.colors.primary }}>
            {t('profile.completenessNext', { item: t(`profile.completenessItems.${next.key}`) })}
          </Text>
          <Text variant={TextVariant.Label} style={{ color: theme.colors.primary }}>
            {t('profile.completenessGain', { weight: next.weight })}
          </Text>
          <Icon icon={ChevronRight} color={theme.colors.primary} />
        </Pressable>
      ) : (
        <Text tone={TextTone.Muted}>{t('profile.completenessDone')}</Text>
      )}
    </Card>
  );
}

function ProfileContent({ profile, refreshing, onRefresh }: { profile: Profile; refreshing: boolean; onRefresh: () => void }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useProfileSettings();
  const reorderContacts = useReorderContacts();
  const reorderDocuments = useReorderDocuments();
  const uploadDocument = useUploadNewDocument();
  const changePhoto = useChangePhoto();
  const documents = [...profile.documents].sort((a, b) => a.position - b.position);
  const contacts = sortContacts(profile.contacts);

  const fixed: Record<ProfileBlock, () => ReactNode> = {
    [ProfileBlock.About]: () => (
      <BlockCard icon={UserRound} title={t('profile.about')} action={<Button label={t('common.edit')} icon={Pencil} variant={ButtonVariant.Secondary} onPress={() => router.push(Routes.editBasics)} />}>
        <Text tone={profile.summary ? TextTone.Default : TextTone.Muted}>{profile.summary || t('profile.aboutEmpty')}</Text>
      </BlockCard>
    ),
    [ProfileBlock.Contacts]: () => (
      <BlockCard icon={Mail} title={t('profile.contacts')} action={<AddButton label={t('common.add')} onPress={() => router.push(Routes.editContact())} />}>
        {contacts.length === 0 ? (
          <Text tone={TextTone.Muted}>{t('profile.contactsEmpty')}</Text>
        ) : (
          <>
            <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
              {t('common.dragToReorder')}
            </Text>
            <SortableList items={contacts} keyOf={(c) => c.id} labelOf={(c) => c.value} onReorder={reorderContacts.move} renderItem={(contact) => <ContactRow contact={contact} onPress={() => router.push(Routes.editContact(contact.id))} />} />
          </>
        )}
      </BlockCard>
    ),
    [ProfileBlock.Skills]: () => (
      <BlockCard icon={Sparkles} title={t('profile.skills')} action={<Button label={t('common.edit')} icon={Pencil} variant={ButtonVariant.Secondary} onPress={() => router.push(Routes.editSkills)} />}>
        {profile.skills.length === 0 ? (
          <Text tone={TextTone.Muted}>{t('profile.skillsEmpty')}</Text>
        ) : (
          <Row wrap>
            {profile.skills.map((skill) => (
              <Badge key={skill} label={skill} tone={StatusTone.Primary} />
            ))}
          </Row>
        )}
      </BlockCard>
    ),
    [ProfileBlock.Documents]: () => (
      <BlockCard icon={FileText} title={t('profile.documents')}>
        {documents.length === 0 ? <Text tone={TextTone.Muted}>{t('profile.documentsEmpty')}</Text> : null}
        {documents.length > 0 ? (
          <SortableList items={documents} keyOf={(d) => d.id} labelOf={(d) => d.name} onReorder={reorderDocuments.move} renderItem={(document) => <DocumentRow document={document} onPress={() => router.push(Routes.document(document.id))} />} />
        ) : null}
        <Button label={t('profile.uploadPdf')} icon={Upload} variant={ButtonVariant.Outline} onPress={() => void uploadDocument.start()} loading={uploadDocument.isPending} />
      </BlockCard>
    ),
  };

  const sectionByKey = new Map(settings.sections.map((section) => [section.key, section]));
  const ordered = [...settings.pageOrder, ...settings.sections.map((s) => s.key).filter((key) => !settings.pageOrder.includes(key))];

  const goTo = (key: string) => {
    const actions: Record<string, () => void> = {
      basics: () => router.push(Routes.editBasics),
      photo: () => void changePhoto.start(),
      contacts: () => router.push(Routes.editContact()),
      skills: () => router.push(Routes.editSkills),
      documents: () => void uploadDocument.start(),
    };
    (actions[key] ?? (() => sectionByKey.has(key) && router.push(Routes.editEntry(key))))();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} testID="profile-screen">
      <Header profile={profile} onNext={goTo} />
      {ordered.map((key) => {
        const section = sectionByKey.get(key);
        const content = isEnumValue(ProfileBlock, key) ? fixed[key]() : section ? <SectionBlock section={section} entries={profile.sections[section.key]} /> : null;
        return content ? <View key={key}>{content}</View> : null;
      })}
      {profile.signatureUrl ? (
        <BlockCard icon={Pencil} title={t('profile.signature')}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t('profile.signature')}. ${t('profile.tapToZoom')}`}
            onPress={() => profile.signatureUrl && router.push(Routes.viewer(profile.signatureUrl, t('profile.signature')))}
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.control, padding: theme.space.sm }}
          >
            <Image source={{ uri: profile.signatureUrl }} style={{ width: '100%', aspectRatio: 3 }} contentFit="contain" />
          </Pressable>
        </BlockCard>
      ) : null}
    </Screen>
  );
}

export function ProfileScreen() {
  const profile = useProfile();
  if (profile.isPending) {
    return <LoadingState />;
  }
  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }
  return <ProfileContent profile={profile.data} refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} />;
}
