import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ConversationSummary, MemberCard } from '@careerpilot/api-client';
import { useConversations, useFormat, useMemberSearch, useServices, useStartConversation, useT, useTeamConversation } from '@careerpilot/client-core';
import { ConversationKind, MessageKind } from '@careerpilot/domain-ui-logic';
import { BellOff, Headset, MessageSquarePlus, Search, X } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, EmptyState, ErrorState, Icon, IconSize, LoadingState, Text, TextTone, TextVariant, useInputFocus } from '@/ui';
import { ChatAvatar, StateTicks } from './message-parts';

const AVATAR = 48;

function preview(conversation: ConversationSummary, t: (key: string) => string): string {
  if (conversation.lastMessageKind === MessageKind.Image) {
    return t('messaging.photo');
  }
  if (conversation.lastMessageKind === MessageKind.Voice) {
    return t('messaging.voice');
  }
  return conversation.lastMessagePreview;
}

function ChatRow({ conversation, onPress }: { conversation: ConversationSummary; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const unread = conversation.unreadCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `${conversation.title}, ${t('messaging.unread', { count: conversation.unreadCount })}` : conversation.title}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.sm, opacity: pressed ? theme.opacity.muted : 1 })}
      testID={`chat-${conversation.id}`}
    >
      <ChatAvatar name={conversation.title} photoUrl={conversation.photoUrl} team={conversation.kind === ConversationKind.Team} size={AVATAR} />
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Text variant={TextVariant.Subheading} numberOfLines={1} style={{ flexShrink: 1 }}>
            {conversation.title}
          </Text>
          {conversation.muted ? <Icon icon={BellOff} size={IconSize.Small} color={theme.colors.textMuted} /> : null}
          <Text variant={TextVariant.Caption} tone={unread ? TextTone.Primary : TextTone.Muted} style={{ marginLeft: 'auto' }}>
            {conversation.lastMessageAt ? format.timeOf(conversation.lastMessageAt) : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          {conversation.lastFromMe ? <StateTicks state={conversation.lastState} tint={theme.colors.textMuted} /> : null}
          <Text variant={TextVariant.Label} tone={unread ? TextTone.Default : TextTone.Muted} numberOfLines={1} style={{ flex: 1 }}>
            {preview(conversation, t)}
          </Text>
          {unread ? (
            <View style={{ minWidth: theme.space.xl, paddingHorizontal: theme.space.xs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary, alignItems: 'center' }}>
              <Text variant={TextVariant.Caption} style={{ color: theme.colors.primaryForeground, fontWeight: theme.fontWeight.bold }}>
                {conversation.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function MemberRow({ member, onMessage, busy }: { member: MemberCard; onMessage: () => void; busy: boolean }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.sm }}>
      <ChatAvatar name={member.name} photoUrl={member.photoUrl} size={AVATAR} />
      <View style={{ flex: 1 }}>
        <Text variant={TextVariant.Subheading} numberOfLines={1}>
          {member.name}
        </Text>
        {member.headline ? (
          <Text variant={TextVariant.Caption} tone={TextTone.Muted} numberOfLines={1}>
            {member.headline}
          </Text>
        ) : null}
      </View>
      <Button label={t('messaging.message')} accessibilityLabel={t('messaging.messageLabel', { name: member.name })} variant={ButtonVariant.Secondary} loading={busy} onPress={onMessage} testID={`message-${member.id}`} />
    </View>
  );
}

function MemberSearch({ onClose }: { onClose: () => void }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { config } = useServices();
  const [query, setQuery] = useState('');
  const results = useMemberSearch(query);
  const start = useStartConversation();
  const searching = query.trim().length >= config.messaging.directoryMinQuery;
  const focus = useInputFocus();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, minHeight: theme.touchTarget, paddingHorizontal: theme.space.md, borderRadius: theme.radius.control, borderWidth: focus.focused ? theme.borderWidth.focus : theme.borderWidth.hairline, borderColor: focus.focused ? theme.colors.primary : theme.colors.input }}>
        <Icon icon={Search} size={IconSize.Small} color={theme.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('messaging.searchPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('messaging.searchLabel')}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          style={{ flex: 1, color: theme.colors.text, fontSize: theme.fontSize.md, paddingVertical: theme.space.sm }}
          testID="member-search"
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={theme.space.sm}>
          <Icon icon={X} size={IconSize.Small} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('messaging.searchHint')}
      </Text>
      {searching && results.data?.length === 0 ? <Text tone={TextTone.Muted}>{t('messaging.searchEmpty')}</Text> : null}
      {(results.data ?? []).map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          busy={start.isPending && start.variables === member.id}
          onMessage={() => void start.mutateAsync(member.id).then((conversation) => router.push(Routes.chat(conversation.id)))}
        />
      ))}
    </Card>
  );
}

export function ChatsScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const chats = useConversations();
  const team = useTeamConversation();
  const [searching, setSearching] = useState(false);
  if (chats.isPending) {
    return <LoadingState />;
  }
  if (chats.isError) {
    return <ErrorState onRetry={() => void chats.refetch()} />;
  }
  const header = (
    <View style={{ gap: theme.space.md, paddingBottom: theme.space.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <Button label={t('messaging.newChat')} icon={MessageSquarePlus} onPress={() => setSearching((open) => !open)} style={{ flex: 1 }} testID="new-chat" />
        <Button
          label={t('messaging.teamContact')}
          icon={Headset}
          variant={ButtonVariant.Outline}
          loading={team.isPending}
          onPress={() => void team.mutateAsync().then((conversation) => router.push(Routes.chat(conversation.id)))}
          style={{ flex: 1 }}
          testID="team-chat"
        />
      </View>
      {searching ? <MemberSearch onClose={() => setSearching(false)} /> : null}
    </View>
  );
  return (
    <FlatList
      data={chats.data}
      keyExtractor={(conversation) => conversation.id}
      style={{ backgroundColor: theme.colors.surface }}
      contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xs }}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState body={t('messaging.empty')} />}
      ItemSeparatorComponent={() => <View style={{ height: theme.borderWidth.hairline, backgroundColor: theme.colors.border }} />}
      renderItem={({ item }) => <ChatRow conversation={item} onPress={() => router.push(Routes.chat(item.id))} />}
      testID="chats-screen"
    />
  );
}
