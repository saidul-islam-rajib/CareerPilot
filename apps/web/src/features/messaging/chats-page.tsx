'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellOff, Headset, MessageSquarePlus, Search } from 'lucide-react';
import type { ConversationSummary } from '@careerpilot/api-client';
import { useConversations, useFormat, useMemberSearch, useServices, useStartConversation, useT, useTeamConversation } from '@careerpilot/client-core';
import { ConversationKind, MessageKind } from '@careerpilot/domain-ui-logic';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, cn } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { MemberAvatar, StateTicks } from './message-parts';

function preview(conversation: ConversationSummary, t: (key: string) => string): string {
  if (!conversation.lastMessageKind || conversation.lastMessageKind === MessageKind.Text || conversation.lastMessageKind === MessageKind.File) {
    return conversation.lastMessagePreview;
  }
  return t(conversation.lastMessageKind === MessageKind.Image ? 'messaging.photo' : 'messaging.voice');
}

function ChatRow({ conversation }: { conversation: ConversationSummary }) {
  const t = useT();
  const format = useFormat();
  const unread = conversation.unreadCount > 0;
  return (
    <li>
      <Link
        href={Routes.conversation(conversation.id)}
        className="flex min-h-16 items-center gap-3 rounded-control px-2 py-2 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <MemberAvatar name={conversation.title} photoUrl={conversation.photoUrl} team={conversation.kind === ConversationKind.Team} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-foreground', unread ? 'font-bold' : 'font-semibold')}>{conversation.title}</span>
            {conversation.muted ? <BellOff className="size-3.5 shrink-0 text-muted" aria-label={t('messaging.muted')} /> : null}
            <span className={cn('ml-auto shrink-0 text-xs', unread ? 'font-semibold text-primary' : 'text-muted')}>
              {conversation.lastMessageAt ? format.timeOf(conversation.lastMessageAt) : ''}
            </span>
          </span>
          <span className="flex items-center gap-1">
            {conversation.lastFromMe ? <StateTicks state={conversation.lastState} className="shrink-0 text-muted" /> : null}
            <span className={cn('truncate text-sm', unread ? 'font-medium text-foreground' : 'text-muted')}>{preview(conversation, t)}</span>
            {unread ? (
              <span className="ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-pill bg-primary px-1.5 text-xs font-bold text-primary-foreground" aria-label={t('messaging.unread', { count: conversation.unreadCount })}>
                {conversation.unreadCount}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

function MemberSearch() {
  const t = useT();
  const router = useRouter();
  const { config } = useServices();
  const [query, setQuery] = useState('');
  const results = useMemberSearch(query);
  const start = useStartConversation();
  const searching = query.trim().length >= config.messaging.directoryMinQuery;
  return (
    <Card className="gap-3">
      <label htmlFor="member-search" className="font-semibold text-foreground">
        {t('messaging.searchLabel')}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="member-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('messaging.searchPlaceholder')}
          className="h-12 w-full rounded-control border border-input bg-background pl-10 pr-3 text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </div>
      <p className="text-xs text-muted">{t('messaging.searchHint')}</p>
      {searching && results.data?.length === 0 ? <p className="text-sm text-muted">{t('messaging.searchEmpty')}</p> : null}
      {results.data?.length ? (
        <ul className="flex flex-col">
          {results.data.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-2">
              <MemberAvatar name={member.name} photoUrl={member.photoUrl} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-foreground">{member.name}</span>
                {member.headline ? <span className="truncate text-sm text-muted">{member.headline}</span> : null}
              </span>
              <Button
                size="sm"
                variant="secondary"
                loading={start.isPending && start.variables === member.id}
                aria-label={t('messaging.messageLabel', { name: member.name })}
                onClick={() => void start.mutateAsync(member.id).then((conversation) => router.push(Routes.conversation(conversation.id)))}
              >
                {t('messaging.message')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function ChatsPage() {
  const t = useT();
  const router = useRouter();
  const chats = useConversations();
  const team = useTeamConversation();
  const [searching, setSearching] = useState(false);
  const openTeam = () => void team.mutateAsync().then((conversation) => router.push(Routes.conversation(conversation.id)));
  return (
    <>
      <PageHeader
        title={t('messaging.title')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Headset} loading={team.isPending} onClick={openTeam}>
              {t('messaging.teamContact')}
            </Button>
            <Button icon={MessageSquarePlus} onClick={() => setSearching((open) => !open)} aria-expanded={searching}>
              {t('messaging.newChat')}
            </Button>
          </div>
        }
      />
      {searching ? <MemberSearch /> : null}
      {chats.isPending ? (
        <LoadingState />
      ) : chats.isError ? (
        <ErrorState onRetry={() => void chats.refetch()} />
      ) : chats.data.length === 0 ? (
        <EmptyState body={t('messaging.empty')} />
      ) : (
        <Card className="p-2">
          <ul className="divide-y divide-border">
            {chats.data.map((conversation) => (
              <ChatRow key={conversation.id} conversation={conversation} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
