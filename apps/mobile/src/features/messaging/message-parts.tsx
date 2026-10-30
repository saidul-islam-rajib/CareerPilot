import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { MessageView, ReplyPreview } from '@careerpilot/api-client';
import { messageStateKey, quoteSender, quoteText, useFormat, useT } from '@careerpilot/client-core';
import { MessageKind, MessageState } from '@careerpilot/domain-ui-logic';
import { Check, CheckCheck, FileText, Users } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Avatar, Icon, IconSize, Text, TextTone, TextVariant } from '@/ui';
import { SwipeToReply } from './swipe-to-reply';
import { VoicePlayer } from './voice';

const KILOBYTE = 1024;
const IMAGE_WIDTH = 220;
const IMAGE_HEIGHT = 260;
const REPLY_ACTION = 'reply';

export function ChatAvatar({ name, photoUrl, team = false, size }: { name: string; photoUrl?: string; team?: boolean; size: number }) {
  const theme = useTheme();
  if (team) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySubtle }}>
        <Icon icon={Users} color={theme.colors.primary} />
      </View>
    );
  }
  return <Avatar name={name} uri={photoUrl} size={size} />;
}

export function StateTicks({ state, tint }: { state?: MessageState; tint: string }) {
  const t = useT();
  const theme = useTheme();
  const key = messageStateKey(state);
  if (!state || !key) {
    return null;
  }
  const color = state === MessageState.Read ? theme.colors.info : tint;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t(key)} testID={`ticks-${state}`}>
      <Icon icon={state === MessageState.Sent ? Check : CheckCheck} size={IconSize.Small} color={color} />
    </View>
  );
}

function Attachment({ message, tint }: { message: MessageView; tint: string }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const file = message.attachment;
  if (!file) {
    return null;
  }
  if (message.kind === MessageKind.Image) {
    return (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={t('messaging.openFile', { name: file.fileName })} onPress={() => router.push(Routes.viewer(file.url, file.fileName))}>
        <Image source={{ uri: file.url }} style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, borderRadius: theme.radius.control }} resizeMode="cover" />
      </Pressable>
    );
  }
  if (message.kind === MessageKind.Voice) {
    return <VoicePlayer url={file.url} durationSeconds={file.durationSeconds} tint={tint} />;
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('messaging.openFile', { name: file.fileName })}
      onPress={() => void WebBrowser.openBrowserAsync(file.url)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, padding: theme.space.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.background }}
    >
      <Icon icon={FileText} color={theme.colors.danger} />
      <View style={{ flexShrink: 1 }}>
        <Text variant={TextVariant.Label} numberOfLines={1}>
          {file.fileName}
        </Text>
        <Text variant={TextVariant.Caption}>{`${Math.max(1, Math.round(file.sizeBytes / KILOBYTE))} KB`}</Text>
      </View>
    </Pressable>
  );
}

export function Quote({ reply, mine, onPress }: { reply: ReplyPreview; mine: boolean; onPress?: (id: string) => void }) {
  const t = useT();
  const theme = useTheme();
  const sender = quoteSender(reply, t);
  const text = quoteText(reply, t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('messaging.quoteLabel', { name: sender, text })}
      accessibilityHint={t('messaging.showOriginal')}
      onPress={() => onPress?.(reply.id)}
      testID={`quote-${reply.id}`}
      style={{
        gap: theme.space.xxs,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xs,
        borderRadius: theme.radius.control,
        borderLeftWidth: theme.borderWidth.accent,
        borderLeftColor: theme.colors.primary,
        backgroundColor: mine ? theme.colors.primarySubtle : theme.colors.surface,
      }}
    >
      <Text variant={TextVariant.Caption} numberOfLines={1} style={{ color: theme.colors.primary, fontWeight: theme.fontWeight.semibold }}>
        {sender}
      </Text>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted} numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}

export interface MessageBubbleProps {
  message: MessageView;
  showSender: boolean;
  onReply?: (message: MessageView) => void;
  onQuote?: (id: string) => void;
  highlighted?: boolean;
}

export function MessageBubble({ message, showSender, onReply, onQuote, highlighted = false }: MessageBubbleProps) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const mine = message.fromMe;
  const tint = mine ? theme.colors.primaryForeground : theme.colors.text;
  const reply = onReply ? () => onReply(message) : undefined;
  const bubble = (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <Pressable
        accessible={false}
        onLongPress={reply}
        testID={`message-${message.id}`}
        style={{
          maxWidth: '82%',
          gap: theme.space.xxs,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
          borderRadius: theme.radius.card,
          borderBottomRightRadius: mine ? theme.space.xxs : theme.radius.card,
          borderBottomLeftRadius: mine ? theme.radius.card : theme.space.xxs,
          backgroundColor: mine ? theme.colors.primary : theme.colors.card,
          borderWidth: highlighted ? theme.borderWidth.focus : mine ? 0 : theme.borderWidth.hairline,
          borderColor: highlighted ? theme.colors.focusRing : theme.colors.border,
        }}
      >
        {showSender && !mine ? (
          <Text variant={TextVariant.Caption} style={{ color: theme.colors.primary, fontWeight: theme.fontWeight.semibold }}>
            {message.senderName}
          </Text>
        ) : null}
        {message.replyTo ? <Quote reply={message.replyTo} mine={mine} onPress={onQuote} /> : null}
        <Attachment message={message} tint={tint} />
        {message.text ? <Text style={{ color: tint }}>{message.text}</Text> : null}
        <View
          accessible
          accessibilityHint={reply ? t('messaging.replyHint') : undefined}
          accessibilityActions={reply ? [{ name: REPLY_ACTION, label: t('messaging.reply') }] : undefined}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === REPLY_ACTION) {
              reply?.();
            }
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: theme.space.xxs }}
          testID={`message-meta-${message.id}`}
        >
          <Text variant={TextVariant.Caption} style={{ color: tint, opacity: theme.opacity.muted }}>
            {format.timeOf(message.createdAt)}
          </Text>
          {mine ? <StateTicks state={message.state} tint={tint} /> : null}
        </View>
      </Pressable>
    </View>
  );
  return reply ? <SwipeToReply onReply={reply}>{bubble}</SwipeToReply> : bubble;
}
