'use client';

import { Check, CheckCheck, FileText, Users } from 'lucide-react';
import type { MessageView } from '@careerpilot/api-client';
import { messageStateKey, useFormat, useT, voiceLength } from '@careerpilot/client-core';
import { MessageKind, MessageState } from '@careerpilot/domain-ui-logic';
import { cn } from '@careerpilot/ui-web';

const KILOBYTE = 1024;

export function MemberAvatar({ name, photoUrl, team = false, className }: { name: string; photoUrl?: string; team?: boolean; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span className={cn('flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-subtle font-semibold text-primary', className)} aria-hidden>
      {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : team ? <Users className="size-5" /> : initials}
    </span>
  );
}

export function StateTicks({ state, className }: { state?: MessageState; className?: string }) {
  const t = useT();
  const key = messageStateKey(state);
  if (!state || !key) {
    return null;
  }
  const Glyph = state === MessageState.Sent ? Check : CheckCheck;
  return (
    <span className={cn('inline-flex', state === MessageState.Read ? 'text-info' : 'opacity-70', className)} role="img" aria-label={t(key)}>
      <Glyph className="size-4" aria-hidden />
    </span>
  );
}

function Attachment({ message }: { message: MessageView }) {
  const t = useT();
  const file = message.attachment;
  if (!file) {
    return null;
  }
  if (message.kind === MessageKind.Image) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer noopener" aria-label={t('messaging.openFile', { name: file.fileName })}>
        <img src={file.url} alt={file.fileName} className="max-h-72 w-full max-w-xs rounded-control object-cover" />
      </a>
    );
  }
  if (message.kind === MessageKind.Voice) {
    return (
      <span className="flex flex-col gap-1">
        <audio controls preload="metadata" src={file.url} className="h-10 w-64 max-w-full" aria-label={t('messaging.play')} />
        <span className="text-xs opacity-80">{voiceLength(file.durationSeconds)}</span>
      </span>
    );
  }
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-3 rounded-control bg-background/70 p-2 text-foreground hover:underline"
      aria-label={t('messaging.openFile', { name: file.fileName })}
    >
      <FileText className="size-8 shrink-0 text-danger" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{file.fileName}</span>
        <span className="text-xs text-muted">{Math.max(1, Math.round(file.sizeBytes / KILOBYTE))} KB</span>
      </span>
    </a>
  );
}

export function MessageBubble({ message, showSender }: { message: MessageView; showSender: boolean }) {
  const format = useFormat();
  const mine = message.fromMe;
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1 rounded-card px-3 py-2 shadow-sm sm:max-w-[70%]',
          mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border border-border bg-card text-foreground',
        )}
      >
        {showSender && !mine ? <span className="text-xs font-semibold text-primary">{message.senderName}</span> : null}
        <Attachment message={message} />
        {message.text ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
        <span className={cn('flex items-center justify-end gap-1 text-[11px]', mine ? 'text-primary-foreground/80' : 'text-muted')}>
          {format.timeOf(message.createdAt)}
          {mine ? <StateTicks state={message.state} /> : null}
        </span>
      </div>
    </li>
  );
}
