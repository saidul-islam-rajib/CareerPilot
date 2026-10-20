import { useRouter } from 'expo-router';
import { sortContacts, useFormat, useProfile, useReorderContacts, useSetPrimaryContact, useT } from '@careerpilot/client-core';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { BadgeCheck, FileText, GraduationCap, Mail, Phone, Star } from 'lucide-react-native';
import { ContactKind, StatusTone } from '@careerpilot/domain-ui-logic';
import type { Contact } from '@careerpilot/api-client';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import {
  Avatar,
  Badge,
  Card,
  ErrorState,
  Icon,
  IconSize,
  ListRow,
  LoadingState,
  ProgressBar,
  Row,
  Screen,
  Section,
  SortableList,
  Text,
  TextTone,
  TextVariant,
} from '@/ui';

const PERCENT = 100;

function ContactRow({ contact, onMakePrimary }: { contact: Contact; onMakePrimary: () => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingVertical: theme.space.sm }}>
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
      {contact.isPrimary ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.makePrimary')}: ${contact.value}`} onPress={onMakePrimary} hitSlop={theme.space.xs}>
          <Icon icon={Star} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function ProfileScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const profile = useProfile();
  const reorder = useReorderContacts();
  const setPrimary = useSetPrimaryContact();

  if (profile.isPending) {
    return <LoadingState />;
  }
  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }
  const p = profile.data;
  const avatarSize = theme.space.xxxl * 2;

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} testID="profile-screen">
      <Card>
        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t('profile.photo')}. ${t('profile.tapToZoom')}`}
            disabled={!p.photoUrl}
            onPress={() => p.photoUrl && router.push(Routes.viewer(p.photoUrl, t('profile.photo')))}
          >
            <Avatar name={p.fullName} uri={p.photoUrl} size={avatarSize} />
          </Pressable>
          <Text variant={TextVariant.Title} align="center">
            {p.fullName}
          </Text>
          <Text tone={TextTone.Muted} align="center">
            {p.headline}
          </Text>
        </View>
        <ProgressBar value={p.completeness / PERCENT} label={t('profile.completeness', { percent: p.completeness })} />
      </Card>

      <Section title={t('profile.contacts')}>
        <Card>
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {t('common.dragToReorder')}
          </Text>
          <SortableList
            items={sortContacts(p.contacts)}
            keyOf={(c) => c.id}
            labelOf={(c) => c.value}
            onReorder={reorder.move}
            renderItem={(contact) => <ContactRow contact={contact} onMakePrimary={() => setPrimary.mutate(contact.id)} />}
          />
        </Card>
      </Section>

      <Section title={t('profile.signature')}>
        <Card>
          {p.signatureUrl ? (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`${t('profile.signature')}. ${t('profile.tapToZoom')}`}
              onPress={() => p.signatureUrl && router.push(Routes.viewer(p.signatureUrl, t('profile.signature')))}
              style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.control, padding: theme.space.sm }}
            >
              <Image source={{ uri: p.signatureUrl }} style={{ width: '100%', aspectRatio: 3 }} contentFit="contain" />
            </Pressable>
          ) : null}
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {t('profile.tapToZoom')}
          </Text>
        </Card>
      </Section>

      <Section title={t('profile.experience')}>
        <Card>
          {p.experience.map((item) => (
            <View key={item.id} style={{ gap: theme.space.xxs, paddingVertical: theme.space.xs }}>
              <Text variant={TextVariant.Subheading}>{item.title}</Text>
              <Text variant={TextVariant.Label} tone={TextTone.Muted}>
                {item.organization} · {format.date(item.start)} – {item.end ? format.date(item.end) : t('profile.present')}
              </Text>
              <Text>{item.summary}</Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section title={t('profile.education')}>
        <Card>
          {p.education.map((item) => (
            <ListRow
              key={item.id}
              icon={GraduationCap}
              title={item.degree}
              subtitle={[item.institution, `${item.startYear}–${item.endYear ?? t('profile.present')}`, item.result].filter(Boolean).join(' · ')}
            />
          ))}
        </Card>
      </Section>

      <Section title={t('profile.skills')}>
        <Row wrap>
          {p.skills.map((skill) => (
            <Badge key={skill} label={skill} tone={StatusTone.Primary} />
          ))}
        </Row>
      </Section>

      <Section title={t('profile.documents')}>
        <Card>
          {p.documents.map((doc) => (
            <ListRow key={doc.id} icon={FileText} title={doc.name} subtitle={`${t('profile.version', { version: doc.version })} · ${t('common.updatedAt', { date: format.date(doc.updatedAt) })}`} />
          ))}
        </Card>
      </Section>

    </Screen>
  );
}
