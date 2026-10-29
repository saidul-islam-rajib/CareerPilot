import { useDeferredValue, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification, MessagePage, NewAttachment } from '@careerpilot/api-client';
import { MessageState, NotificationTarget } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';
import { SessionStatus, useSession } from '../session/session';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const PAD = 2;

export interface NotificationDestination {
  target: NotificationTarget;
  id: string;
}

export function notificationDestination(notification: AppNotification): NotificationDestination {
  return { target: notification.target, id: notification.targetId };
}

export function voiceLength(seconds: number | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(total / SECONDS_PER_MINUTE)}:${String(total % SECONDS_PER_MINUTE).padStart(PAD, '0')}`;
}

export function messageStateKey(state: MessageState | undefined): string | undefined {
  return state ? `messaging.states.${state}` : undefined;
}

function usePollInterval(open = false): number {
  const { config } = useServices();
  return (open ? config.messaging.openConversationPollSeconds : config.messaging.pollSeconds) * MS_PER_SECOND;
}

function useSignedIn(): boolean {
  return useSession().status === SessionStatus.SignedIn;
}

export function useInbox() {
  const api = useApi();
  const interval = usePollInterval();
  return useQuery({ queryKey: queryKeys.inbox, queryFn: () => api.messaging.inbox(), refetchInterval: interval, enabled: useSignedIn() });
}

export function useNewNotifications(onNew: (notification: AppNotification) => void) {
  const inbox = useInbox();
  const seen = useRef<Set<string> | undefined>(undefined);
  const latest = inbox.data?.latest;
  useEffect(() => {
    if (!latest) {
      return;
    }
    if (!seen.current) {
      seen.current = new Set(latest.map((n) => n.id));
      return;
    }
    const known = seen.current;
    latest.filter((n) => !known.has(n.id)).forEach((n) => {
      known.add(n.id);
      onNew(n);
    });
  }, [latest, onNew]);
}

export function useNotifications() {
  const api = useApi();
  const interval = usePollInterval();
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => api.messaging.notifications(), refetchInterval: interval });
}

function useMessagingRefresh() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.inbox }),
      client.invalidateQueries({ queryKey: queryKeys.notifications }),
      client.invalidateQueries({ queryKey: queryKeys.conversations }),
    ]);
  };
}

export function useReadNotifications() {
  const api = useApi();
  const refresh = useMessagingRefresh();
  return useMutation({ mutationFn: (ids?: string[]) => api.messaging.readNotifications(ids), onSuccess: refresh });
}

export function useConversations() {
  const api = useApi();
  const interval = usePollInterval();
  return useQuery({ queryKey: queryKeys.conversations, queryFn: () => api.messaging.conversations(), refetchInterval: interval });
}

function hasUnreadFromOthers(page: MessagePage | undefined): boolean {
  return (page?.conversation.unreadCount ?? 0) > 0;
}

export function useConversation(conversationId: string) {
  const api = useApi();
  const client = useQueryClient();
  const refresh = useMessagingRefresh();
  const interval = usePollInterval(true);
  const key = queryKeys.conversation(conversationId);
  const page = useQuery({ queryKey: key, queryFn: () => api.messaging.messages(conversationId), refetchInterval: interval });
  const unread = hasUnreadFromOthers(page.data);
  useEffect(() => {
    if (unread) {
      void api.messaging.read(conversationId).then(refresh);
    }
  }, [api, conversationId, refresh, unread]);
  const sent = async () => {
    await client.invalidateQueries({ queryKey: key });
    await refresh();
  };
  const sendText = useMutation({ mutationFn: (text: string) => api.messaging.sendText(conversationId, text), onSuccess: sent });
  const sendAttachment = useMutation({ mutationFn: (attachment: NewAttachment) => api.messaging.sendAttachment(conversationId, attachment), onSuccess: sent });
  const mute = useMutation({ mutationFn: (muted: boolean) => api.messaging.mute(conversationId, muted), onSuccess: sent });
  return { page, sendText, sendAttachment, mute };
}

export function useMemberSearch(query: string) {
  const api = useApi();
  const { config } = useServices();
  const typed = useDeferredValue(query.trim());
  return useQuery({
    queryKey: queryKeys.memberSearch(typed),
    queryFn: () => api.messaging.searchMembers(typed),
    enabled: typed.length >= config.messaging.directoryMinQuery,
  });
}

export function useStartConversation() {
  const api = useApi();
  const refresh = useMessagingRefresh();
  return useMutation({ mutationFn: (memberId: string) => api.messaging.start(memberId), onSuccess: refresh });
}

export function useTeamConversation() {
  const api = useApi();
  const refresh = useMessagingRefresh();
  return useMutation({ mutationFn: () => api.messaging.team(), onSuccess: refresh });
}

export function useBlockMember() {
  const api = useApi();
  const client = useQueryClient();
  const refresh = useMessagingRefresh();
  return useMutation({
    mutationFn: ({ memberId, blocked }: { memberId: string; blocked: boolean }) => api.messaging.block(memberId, blocked),
    onSuccess: async () => {
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: queryKeys.settings }), client.invalidateQueries({ queryKey: ['conversation'] })]);
    },
  });
}

export function useDiscoverable() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (discoverable: boolean) => api.messaging.setDiscoverable(discoverable),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useRecordSubmitted(applicationId: string) {
  const api = useApi();
  const client = useQueryClient();
  const refresh = useMessagingRefresh();
  return useMutation({
    mutationFn: () => api.applications.recordSubmitted(applicationId),
    onSuccess: async (record) => {
      client.setQueryData(queryKeys.application(applicationId), record);
      await Promise.all([client.invalidateQueries({ queryKey: queryKeys.applicationsAll }), client.invalidateQueries({ queryKey: queryKeys.dashboard }), refresh()]);
    },
  });
}
