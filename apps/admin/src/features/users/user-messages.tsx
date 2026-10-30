'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCheck, ExternalLink, FileText, MessageCircle, Send, ShieldCheck, UserRound } from 'lucide-react';
import type { MessageView } from '@careerpilot/api-client';
import { messageStateKey, useFormat, useT, voiceLength } from '@careerpilot/client-core';
import { AdminArea, MessageKind, MessageState, PermissionAction } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, EmptyState, ErrorState, FormDialog, ListRow, LoadingState, cn } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';

const KILOBYTE = 1024;

function Bubble({ message }: { message: MessageView }) {
  const t = useT();
  const format = useFormat();
  const mine = message.fromMe;
  const key = messageStateKey(message.state);
  const file = message.attachment;
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[80%] flex-col gap-1 rounded-card px-3 py-2', mine ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground')}>
        <span className={cn('text-xs font-semibold', mine ? 'text-primary-foreground/80' : 'text-primary')}>{message.senderName}</span>
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
    </li>
  );
}

export function TeamMessagesPanel({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const canWrite = useCan(AdminArea.Users, PermissionAction.Update);
  const [text, setText] = useState('');
  const thread = useQuery({ queryKey: [...adminKeys.user(userId), 'messages'], queryFn: () => api.users.teamMessages(userId), refetchInterval: 5000 });
  const send = useAdminMutation((value: string) => api.users.sendTeamMessage(userId, value));
  if (thread.isPending) {
    return <LoadingState />;
  }
  if (thread.isError) {
    return <ErrorState onRetry={() => void thread.refetch()} />;
  }
  const submit = () => {
    const value = text.trim();
    if (value) {
      void send.mutateAsync(value).then(() => setText(''));
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
            <Bubble key={message.id} message={message} />
          ))}
        </ol>
      )}
      {canWrite ? (
        <div className="flex items-end gap-2">
          <label htmlFor="team-message" className="sr-only">
            {t('admin.messages.compose')}
          </label>
          <textarea
            id="team-message"
            value={text}
            onChange={(event) => setText(event.target.value)}
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
