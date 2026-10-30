import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import * as ImagePicker from 'expo-image-picker';
import { ApiErrorCode, isApiError, type MessageView, type NewAttachment } from '@careerpilot/api-client';
import { useBlockMember, useConversation, useFormat, useServices, useT, voiceLength } from '@careerpilot/client-core';
import { ConversationKind, MessageKind } from '@careerpilot/domain-ui-logic';
import { Ban, Bell, BellOff, FileText, ImageIcon, Mic, Send, Square, X } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { pickDocument, toUploadSource } from '@/features/profile/profile-support';
import { ErrorState, Icon, LoadingState, Text, TextTone, TextVariant, useBottomInset, useInputFocus, useSnackbar } from '@/ui';
import { SnackbarTone } from '@/ui/snackbar';
import { MessageBubble } from './message-parts';
import { useVoiceNote, type RecordedVoice } from './voice';

const ERROR_KEYS: Readonly<Record<string, string>> = {
  member_blocked: 'messaging.errors.member_blocked',
  message_text: 'messaging.errors.message_text',
  file_type: 'messaging.errors.file_type',
  file_too_large: 'messaging.errors.file_too_large',
  voice_too_long: 'messaging.errors.voice_too_long',
};
const IMAGE_QUALITY = 0.8;

function errorKey(error: unknown): string {
  if (isApiError(error) && ERROR_KEYS[error.detail ?? '']) {
    return ERROR_KEYS[error.detail ?? ''] ?? 'messaging.errors.generic';
  }
  return isApiError(error) && error.code === ApiErrorCode.Forbidden ? 'messaging.errors.member_blocked' : 'messaging.errors.generic';
}

function RoundButton({ label, icon, onPress, filled = false, testID, disabled = false }: { label: string; icon: typeof Send; onPress: () => void; filled?: boolean; testID?: string; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={theme.space.xs}
      testID={testID}
      style={{
        width: theme.touchTarget,
        height: theme.touchTarget,
        borderRadius: theme.touchTarget / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? theme.colors.primary : 'transparent',
        opacity: disabled ? theme.opacity.disabled : 1,
      }}
    >
      <Icon icon={icon} color={filled ? theme.colors.primaryForeground : theme.colors.primary} />
    </Pressable>
  );
}

function Composer({ onText, onAttachment, busy }: { onText: (text: string) => Promise<unknown>; onAttachment: (attachment: NewAttachment) => Promise<unknown>; busy: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { config } = useServices();
  const [text, setText] = useState('');
  const voice = useVoiceNote((recorded: RecordedVoice) => void onAttachment({ kind: MessageKind.Voice, file: recorded.file, durationSeconds: recorded.durationSeconds }));
  const send = () => {
    const value = text.trim();
    if (value) {
      void onText(value).then(() => setText(''));
    }
  };
  const photo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: IMAGE_QUALITY, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (asset) {
      void onAttachment({ kind: MessageKind.Image, file: toUploadSource({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, size: asset.fileSize, file: asset.file }) });
    }
  };
  const pdf = async () => {
    const picked = await pickDocument(config.messaging.attachments.file?.types ?? []);
    if (picked) {
      void onAttachment({ kind: MessageKind.File, file: picked });
    }
  };
  const focus = useInputFocus();
  const bottomInset = useBottomInset();
  const bar = {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: theme.space.xs,
    padding: theme.space.sm,
    paddingBottom: theme.space.sm + bottomInset,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  };
  if (voice.recording) {
    return (
      <View style={[bar, { alignItems: 'center' }]}>
        <RoundButton label={t('messaging.cancelRecording')} icon={X} onPress={() => void voice.cancel()} testID="voice-cancel" />
        <Text style={{ flex: 1, color: theme.colors.danger }} accessibilityLiveRegion="polite">
          {t('messaging.recording', { time: voiceLength(voice.seconds) })}
        </Text>
        <RoundButton label={t('messaging.stopRecording')} icon={Square} filled onPress={() => void voice.stop()} testID="voice-stop" />
      </View>
    );
  }
  return (
    <View>
      {voice.denied ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Danger} style={{ paddingHorizontal: theme.space.md }}>
          {t('messaging.microphoneDenied')}
        </Text>
      ) : null}
      <View style={bar}>
        <RoundButton label={t('messaging.photo')} icon={ImageIcon} onPress={() => void photo()} disabled={busy} testID="attach-photo" />
        <RoundButton label={t('messaging.document')} icon={FileText} onPress={() => void pdf()} disabled={busy} testID="attach-pdf" />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('messaging.typeMessage')}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('messaging.typeMessage')}
          multiline
          maxLength={config.messaging.maxTextLength}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          style={{
            flex: 1,
            minHeight: theme.touchTarget,
            maxHeight: theme.touchTarget * 3,
            paddingHorizontal: theme.space.md,
            paddingTop: theme.space.sm,
            paddingBottom: theme.space.sm,
            borderRadius: theme.radius.card,
            borderWidth: focus.focused ? theme.borderWidth.focus : theme.borderWidth.hairline,
            borderColor: focus.focused ? theme.colors.primary : theme.colors.input,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
          }}
          testID="message-input"
        />
        {text.trim() ? (
          <RoundButton label={t('messaging.send')} icon={Send} filled onPress={send} disabled={busy} testID="message-send" />
        ) : (
          <RoundButton label={t('messaging.record')} icon={Mic} filled onPress={() => void voice.start()} disabled={busy} testID="voice-record" />
        )}
      </View>
    </View>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  const theme = useTheme();
  const format = useFormat();
  return (
    <View style={{ alignSelf: 'center', paddingHorizontal: theme.space.md, paddingVertical: theme.space.xxs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.card, marginVertical: theme.space.xs }}>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {format.date(iso)}
      </Text>
    </View>
  );
}

export function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const theme = useTheme();
  const snackbar = useSnackbar();
  const list = useRef<FlatList<MessageView>>(null);
  const headerHeight = useHeaderHeight();
  const bottomInset = useBottomInset();
  const { page, sendText, sendAttachment, mute } = useConversation(id);
  const block = useBlockMember();
  if (page.isPending) {
    return <LoadingState />;
  }
  if (page.isError) {
    return <ErrorState onRetry={() => void page.refetch()} />;
  }
  const { conversation, messages } = page.data;
  const team = conversation.kind === ConversationKind.Team;
  const fail = (error: unknown) => snackbar.show({ message: t(errorKey(error)), tone: SnackbarTone.Danger });
  const toggleBlock = () => {
    if (!conversation.otherMemberId) {
      return;
    }
    const blocked = !conversation.blocked;
    void block.mutateAsync({ memberId: conversation.otherMemberId, blocked }).then(() =>
      snackbar.show({ message: t(blocked ? 'messaging.blocked' : 'messaging.unblocked', { name: conversation.title }) }),
    );
  };
  const reversed = [...messages].reverse();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <Stack.Screen
        options={{
          title: conversation.title,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <RoundButton label={conversation.muted ? t('messaging.unmute') : t('messaging.mute')} icon={conversation.muted ? Bell : BellOff} onPress={() => mute.mutate(!conversation.muted)} testID="conversation-mute" />
              {team ? null : <RoundButton label={conversation.blocked ? t('messaging.unblock') : t('messaging.block')} icon={Ban} onPress={toggleBlock} testID="conversation-block" />}
            </View>
          ),
        }}
      />
      <FlatList
        ref={list}
        inverted
        data={reversed}
        keyExtractor={(message) => message.id}
        contentContainerStyle={{ padding: theme.space.md, gap: theme.space.sm }}
        renderItem={({ item, index }) => {
          const older = reversed[index + 1];
          const newDay = !older || older.createdAt.slice(0, 10) !== item.createdAt.slice(0, 10);
          return (
            <View style={{ gap: theme.space.sm }}>
              {newDay ? <DaySeparator iso={item.createdAt} /> : null}
              <MessageBubble message={item} showSender={team} />
            </View>
          );
        }}
        testID="conversation-messages"
      />
      {conversation.blocked ? (
        <Text tone={TextTone.Muted} align="center" style={{ padding: theme.space.lg, paddingBottom: theme.space.lg + bottomInset, backgroundColor: theme.colors.card }}>
          {t('messaging.blockedNote')}
        </Text>
      ) : (
        <Composer busy={sendAttachment.isPending} onText={(text) => sendText.mutateAsync({ text }).catch(fail)} onAttachment={(attachment) => sendAttachment.mutateAsync(attachment).catch(fail)} />
      )}
    </KeyboardAvoidingView>
  );
}
