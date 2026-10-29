'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, Bell, BellOff, FileText, ImageIcon, Mic, Paperclip, Send, Square, X } from 'lucide-react';
import { ApiErrorCode, isApiError, type MessageView } from '@careerpilot/api-client';
import { useBlockMember, useConversation, useFormat, useServices, useT, voiceLength } from '@careerpilot/client-core';
import { ConversationKind, MessageKind } from '@careerpilot/domain-ui-logic';
import { Button, ErrorState, LoadingState, OverflowMenu, useToast } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { MemberAvatar, MessageBubble } from './message-parts';
import { canRecordVoice, useVoiceRecorder, type VoiceNote } from './use-voice-recorder';

const ERROR_KEYS: Readonly<Record<string, string>> = {
  member_blocked: 'messaging.errors.member_blocked',
  message_text: 'messaging.errors.message_text',
  file_type: 'messaging.errors.file_type',
  file_too_large: 'messaging.errors.file_too_large',
  voice_too_long: 'messaging.errors.voice_too_long',
};

function errorKey(error: unknown): string {
  return (isApiError(error) && ERROR_KEYS[error.detail ?? '']) || (isApiError(error) && error.code === ApiErrorCode.Forbidden ? ERROR_KEYS.member_blocked : undefined) || 'messaging.errors.generic';
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function MessageList({ messages, team }: { messages: MessageView[]; team: boolean }) {
  const format = useFormat();
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1]?.id;
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [last]);
  return (
    <div className="flex-1 overflow-y-auto bg-surface px-3 py-4 sm:px-6" aria-live="polite">
      <ol className="flex flex-col gap-2">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          return (
            <li key={message.id} className="flex flex-col gap-2">
              {newDay ? (
                <span className="mx-auto rounded-pill bg-card px-3 py-1 text-xs font-medium text-muted shadow-sm">{format.date(message.createdAt)}</span>
              ) : null}
              <ul>
                <MessageBubble message={message} showSender={team} />
              </ul>
            </li>
          );
        })}
      </ol>
      <div ref={end} />
    </div>
  );
}

function Composer({ disabled, onText, onFile, onVoice, sending }: { disabled: boolean; sending: boolean; onText: (text: string) => Promise<unknown>; onFile: (file: File, kind: MessageKind) => Promise<unknown>; onVoice: (note: VoiceNote) => Promise<unknown> }) {
  const t = useT();
  const { config } = useServices();
  const [text, setText] = useState('');
  const image = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder((note) => void onVoice(note));
  const send = () => {
    const value = text.trim();
    if (value) {
      void onText(value).then(() => setText(''));
    }
  };
  const pick = (kind: MessageKind) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void onFile(file, kind);
    }
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };
  if (voice.recording) {
    return (
      <div className="flex items-center gap-3 border-t border-border bg-card p-3">
        <span className="size-3 animate-pulse rounded-full bg-danger" aria-hidden />
        <span className="flex-1 font-medium tabular-nums" aria-live="polite">
          {t('messaging.recording', { time: voiceLength(voice.seconds) })}
        </span>
        <Button variant="ghost" icon={X} onClick={voice.cancel}>
          {t('messaging.cancelRecording')}
        </Button>
        <Button icon={Square} onClick={voice.stop}>
          {t('messaging.stopRecording')}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 border-t border-border bg-card p-3">
      {voice.denied ? <p className="text-xs text-danger">{t('messaging.microphoneDenied')}</p> : null}
      <div className="flex items-end gap-2">
        <input ref={image} type="file" accept={config.messaging.attachments.image?.types.join(',')} className="hidden" onChange={pick(MessageKind.Image)} />
        <input ref={pdf} type="file" accept={config.messaging.attachments.file?.types.join(',')} className="hidden" onChange={pick(MessageKind.File)} />
        <OverflowMenu
          label={t('messaging.attach')}
          icon={Paperclip}
          items={[
            { label: t('messaging.photo'), icon: ImageIcon, onSelect: () => image.current?.click(), disabled },
            { label: t('messaging.document'), icon: FileText, onSelect: () => pdf.current?.click(), disabled },
          ]}
        />
        <label className="sr-only" htmlFor="message-text">
          {t('messaging.typeMessage')}
        </label>
        <textarea
          id="message-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
          rows={1}
          maxLength={config.messaging.maxTextLength}
          disabled={disabled}
          placeholder={t('messaging.typeMessage')}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-control border border-input bg-background px-3 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        {text.trim() || !canRecordVoice() ? (
          <Button size="icon" icon={Send} aria-label={t('messaging.send')} onClick={send} disabled={disabled || !text.trim()} loading={sending} />
        ) : (
          <Button size="icon" icon={Mic} aria-label={t('messaging.record')} onClick={() => void voice.start()} disabled={disabled} />
        )}
      </div>
    </div>
  );
}

export function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
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
  const fail = (error: unknown) => toast.show({ message: t(errorKey(error)) });
  const sendFile = (file: File, kind: MessageKind) => sendAttachment.mutateAsync({ kind, file: { name: file.name, type: file.type, size: file.size, blob: file } }).catch(fail);
  const sendVoice = (note: VoiceNote) =>
    sendAttachment.mutateAsync({ kind: MessageKind.Voice, file: note.file, durationSeconds: note.durationSeconds }).catch(fail);
  const toggleBlock = () => {
    if (!conversation.otherMemberId) {
      return;
    }
    const blocked = !conversation.blocked;
    void block.mutateAsync({ memberId: conversation.otherMemberId, blocked }).then(() =>
      toast.show({ message: t(blocked ? 'messaging.blocked' : 'messaging.unblocked', { name: conversation.title }) }),
    );
  };
  const menu = [
    { label: conversation.muted ? t('messaging.unmute') : t('messaging.mute'), icon: conversation.muted ? Bell : BellOff, onSelect: () => mute.mutate(!conversation.muted) },
    ...(team ? [] : [{ label: conversation.blocked ? t('messaging.unblock') : t('messaging.block'), icon: Ban, onSelect: toggleBlock, destructive: !conversation.blocked }]),
  ];
  return (
    <section aria-label={conversation.title} className="-mx-4 -my-6 flex h-[calc(100dvh-8.5rem)] flex-col overflow-hidden border-border bg-card md:-mx-8 md:rounded-card md:border lg:my-0 lg:h-[calc(100dvh-5rem)]">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        <Link href={Routes.messages} aria-label={t('messaging.back')} className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-surface">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <MemberAvatar name={conversation.title} photoUrl={conversation.photoUrl} team={team} className="size-10" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-semibold text-foreground">{conversation.title}</h1>
          {conversation.muted ? <span className="text-xs text-muted">{t('messaging.muted')}</span> : null}
        </div>
        <OverflowMenu label={t('common.more')} items={menu} />
      </header>
      <MessageList messages={messages} team={team} />
      {conversation.blocked ? (
        <p className="border-t border-border bg-card p-4 text-center text-sm text-muted">{t('messaging.blockedNote')}</p>
      ) : (
        <Composer
          disabled={sendAttachment.isPending}
          sending={sendText.isPending}
          onText={(text) => sendText.mutateAsync(text).catch(fail)}
          onFile={sendFile}
          onVoice={sendVoice}
        />
      )}
    </section>
  );
}
