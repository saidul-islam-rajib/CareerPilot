'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCheck, ExternalLink, FileText, MessageCircle, Reply, Send, ShieldCheck, UserRound, X } from 'lucide-react';
import type { MessageView, ReplyPreview } from '@careerpilot/api-client';
import { messageStateKey, quoteSender, quoteText, replyPreviewOf, useFormat, useT, voiceLength } from '@careerpilot/client-core';
import { AdminArea, MessageKind, MessageState, PermissionAction } from '@careerpilot/domain-ui-logic';
import { feedback } from '@careerpilot/ui-tokens';
import { Badge, Button, Card, EmptyState, ErrorState, FormDialog, ListRow, LoadingState, cn } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';

const KILOBYTE = 1024;
const ANCHOR_PREFIX = 'team-message-';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function anchorOf(id: string): string {
  return `${ANCHOR_PREFIX}${id}`;
}

function Quote({ reply, mine, onSelect }: { reply: ReplyPreview; mine: boolean; onSelect?: (id: string) => void }) {
  const t = useT();
  const sender = quoteSender(reply, t);
  const text = quoteText(reply, t);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(reply.id)}
      aria-label={t('messaging.quoteLabel', { name: sender, text })}
      title={t('messaging.showOriginal')}
      className={cn(
        'flex min-w-0 flex-col rounded-control border-l-4 px-2 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        mine ? 'border-primary-foreground bg-primary-foreground/15' : 'border-primary bg-surface',
      )}
    >
      <span className={cn('text-xs font-semibold', mine ? 'text-primary-foreground' : 'text-primary')}>{sender}</span>
      <span className={cn('line-clamp-2 break-words', mine ? 'text-primary-foreground/85' : 'text-muted')}>{text}</span>
    </button>
  );
}

interface BubbleProps {
  message: MessageView;
  onReply?: (message: MessageView) => void;
  onQuote?: (id: string) => void;
  highlighted?: boolean;
}

function Bubble({ message, onReply, onQuote, highlighted = false }: BubbleProps) {
  const t = useT();
  const format = useFormat();
  const mine = message.fromMe;
  const key = messageStateKey(message.state);
  const file = message.attachment;
  const replyButton = onReply ? (
    <Button
      size="icon"
      variant="ghost"
      icon={Reply}
      aria-label={mine ? t('messaging.reply') : t('messaging.replyTo', { name: message.senderName })}
      onClick={() => onReply(message)}
      className="shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    />
  ) : null;
  return (
    <li id={anchorOf(message.id)} className={cn('group flex items-end gap-1', mine ? 'justify-end' : 'justify-start')}>
      {mine ? replyButton : null}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1 rounded-card px-3 py-2 transition-shadow',
          mine ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground',
          highlighted && 'ring-2 ring-focus ring-offset-2 ring-offset-surface',
        )}
      >
        <span className={cn('text-xs font-semibold', mine ? 'text-primary-foreground/80' : 'text-primary')}>{message.senderName}</span>
        {message.replyTo ? <Quote reply={message.replyTo} mine={mine} onSelect={onQuote} /> : null}
        {file && message.kind === MessageKind.Image ? <img src={file.url} alt={file.fileName} className="max-h-60 rounded-control object-cover" /> : null}
        {file && message.kind === MessageKind.Voice ? (
          <span className="flex items-center gap-2">
            <audio controls preload="metadata" src={file.url} className="h-10 max-w-full" />
            <span className="text-xs">{voiceLength(file.durationSeconds)}</span>
          </span>
        ) : null}
        {file && message.kind === MessageKind.File ? (
          <a href={file.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 underline-offset-2 hover:underline">
            <FileText className="size-4" aria-hidden />
            {file.fileName} · {Math.max(1, Math.round(file.sizeBytes / KILOBYTE))} KB
          </a>
        ) : null}
        {message.text ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
        <span className="flex items-center justify-end gap-1 text-[11px] opacity-80">
          {format.dateTime(message.createdAt)}
          {mine && key ? (
            <span role="img" aria-label={t(key)}>
              {message.state === MessageState.Sent ? <Check className="size-3.5" aria-hidden /> : <CheckCheck className="size-3.5" aria-hidden />}
            </span>
          ) : null}
        </span>
      </div>
      {mine ? null : replyButton}
    </li>
  );
}

function ReplyBar({ reply, onCancel }: { reply: ReplyPreview; onCancel: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 rounded-control border-l-4 border-primary bg-surface py-1 pl-3 pr-1" aria-live="polite">
      <Reply className="size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold text-primary">{t('messaging.replyingTo', { name: quoteSender(reply, t) })}</span>
        <span className="truncate text-sm text-muted">{quoteText(reply, t)}</span>
      </div>
      <Button size="icon" variant="ghost" icon={X} aria-label={t('messaging.cancelReply')} onClick={onCancel} />
    </div>
  );
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.(REDUCED_MOTION).matches ? 'auto' : 'smooth';
}

export function TeamMessagesPanel({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const canWrite = useCan(AdminArea.Users, PermissionAction.Update);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<ReplyPreview>();
  const [highlighted, setHighlighted] = useState<string>();
  const thread = useQuery({ queryKey: [...adminKeys.user(userId), 'messages'], queryFn: () => api.users.teamMessages(userId), refetchInterval: 5000 });
  const send = useAdminMutation(({ value, replyToId }: { value: string; replyToId?: string }) => api.users.sendTeamMessage(userId, value, replyToId));
  const replyId = reply?.id;
  useEffect(() => {
    if (replyId) {
      document.getElementById('team-message')?.focus();
    }
  }, [replyId]);
  useEffect(() => {
    const timer = highlighted ? setTimeout(() => setHighlighted(undefined), feedback.highlightMs) : undefined;
    return () => clearTimeout(timer);
  }, [highlighted]);
  if (thread.isPending) {
    return <LoadingState />;
  }
  if (thread.isError) {
    return <ErrorState onRetry={() => void thread.refetch()} />;
  }
  const submit = () => {
    const value = text.trim();
    if (value) {
      void send.mutateAsync({ value, replyToId: reply?.id }).then(() => {
        setText('');
        setReply(undefined);
      });
    }
  };
  const showOriginal = (id: string) => {
    const original = document.getElementById(anchorOf(id));
    if (!original) {
      return;
    }
    original.scrollIntoView?.({ block: 'center', behavior: scrollBehavior() });
    setHighlighted(id);
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && reply) {
      event.preventDefault();
      setReply(undefined);
    }
  };
  return (
    <Card className="gap-4">
      <p className="text-sm text-muted">{t('admin.messages.body')}</p>
      {thread.data.messages.length === 0 ? (
        <EmptyState body={t('admin.messages.empty')} />
      ) : (
        <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto rounded-control bg-surface p-3">
          {thread.data.messages.map((message) => (
            <Bubble
              key={message.id}
              message={message}
              onReply={canWrite ? (chosen) => setReply(replyPreviewOf(chosen)) : undefined}
              onQuote={showOriginal}
              highlighted={highlighted === message.id}
            />
          ))}
        </ol>
      )}
      {canWrite && reply ? <ReplyBar reply={reply} onCancel={() => setReply(undefined)} /> : null}
      {canWrite ? (
        <div className="flex items-end gap-2">
          <label htmlFor="team-message" className="sr-only">
            {t('admin.messages.compose')}
          </label>
          <textarea
            id="team-message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder={t('admin.messages.compose')}
            className="min-h-11 flex-1 resize-y rounded-control border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <Button icon={Send} onClick={submit} loading={send.isPending} disabled={!text.trim()}>
            {t('messaging.send')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function ConnectionsPanel({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const [open, setOpen] = useState<string | null>(null);
  const connections = useQuery({ queryKey: [...adminKeys.user(userId), 'connections'], queryFn: () => api.users.connections(userId) });
  const conversation = useQuery({ queryKey: ['admin', 'conversation', open], queryFn: () => api.users.conversation(open ?? ''), enabled: open !== null });
  if (connections.isPending) {
    return <LoadingState />;
  }
  if (connections.isError) {
    return <ErrorState onRetry={() => void connections.refetch()} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('admin.connections.body')}</p>
      {connections.data.length === 0 ? (
        <EmptyState body={t('admin.connections.empty')} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {connections.data.map((connection) => (
            <li key={connection.conversationId}>
              <Card className="gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-subtle text-primary">
                    {connection.member.photoUrl ? <img src={connection.member.photoUrl} alt="" className="size-full object-cover" /> : <UserRound className="size-5" aria-hidden />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-foreground">{connection.member.name}</span>
                    <span className="truncate text-sm text-muted">{connection.member.headline}</span>
                  </div>
                  <Badge label={t('admin.connections.messages', { count: connection.messages })} />
                </div>
                <p className="text-xs text-muted">
                  {t('admin.connections.since', { date: format.date(connection.connectedAt) })}
                  {connection.lastMessageAt ? ` · ${t('admin.connections.lastActive', { time: format.dateTime(connection.lastMessageAt) })}` : ''}
                </p>
                <Button variant="outline" size="sm" icon={MessageCircle} onClick={() => setOpen(connection.conversationId)}>
                  {t('admin.connections.view')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <FormDialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        title={conversation.data?.conversation.title ?? t('admin.connections.view')}
        description={t('admin.connections.audited')}
        submitLabel={t('common.close')}
        onSubmit={() => setOpen(null)}
      >
        <p className="flex items-center gap-2 text-xs text-muted">
          <ShieldCheck className="size-4" aria-hidden />
          {t('admin.connections.auditedNote')}
        </p>
        {conversation.isPending ? <LoadingState /> : null}
        {conversation.data ? (
          <ol className="flex max-h-[24rem] flex-col gap-2 overflow-y-auto rounded-control bg-surface p-3">
            {conversation.data.messages.map((message) => (
              <Bubble key={message.id} message={{ ...message, fromMe: false }} />
            ))}
          </ol>
        ) : null}
      </FormDialog>
    </div>
  );
}

export function FilesPanel({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const files = useQuery({ queryKey: [...adminKeys.user(userId), 'files'], queryFn: () => api.users.files(userId) });
  if (files.isPending) {
    return <LoadingState />;
  }
  if (files.isError) {
    return <ErrorState onRetry={() => void files.refetch()} />;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="px-2 pt-1 font-semibold text-foreground">{t('admin.files.contacts')}</h3>
        {files.data.contacts.length === 0 ? <EmptyState body={t('admin.files.noContacts')} /> : null}
        {files.data.contacts.map((contact) => (
          <ListRow
            key={`${contact.kind}-${contact.value}`}
            title={contact.value}
            subtitle={[contact.label, contact.primary ? t('admin.files.primary') : '', contact.verified ? t('admin.files.verified') : t('admin.files.unverified')].filter(Boolean).join(' · ')}
          />
        ))}
      </Card>
      <Card>
        <h3 className="px-2 pt-1 font-semibold text-foreground">{t('admin.files.documents')}</h3>
        {files.data.documents.length === 0 ? <EmptyState body={t('admin.files.noDocuments')} /> : null}
        {files.data.documents.map((document) => (
          <ListRow
            key={document.id}
            icon={FileText}
            title={document.name}
            subtitle={`${document.fileName} · v${document.version} · ${Math.max(1, Math.round(document.sizeBytes / KILOBYTE))} KB · ${format.date(document.updatedAt)}`}
            trailing={
              <a href={document.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                <ExternalLink className="size-4" aria-hidden />
                {t('admin.files.open')}
              </a>
            }
          />
        ))}
      </Card>
    </div>
  );
}
