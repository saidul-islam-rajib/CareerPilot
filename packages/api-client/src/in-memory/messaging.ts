import { ConversationKind, MessageKind, MessageState, NotificationKind, NotificationTarget } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, ApiErrorDetail } from '../errors';
import type { Clock, IdGenerator, MessagingApi } from '../ports';
import type { AppNotification, ConversationSummary, MemberCard, MessageView, ReplyPreview, Settings } from '../types';

const MIN_QUERY = 2;
const TEAM_TITLE = 'CareerPilot team';
const MEMORY_FILE = 'memory://file';

interface StoredMessage extends MessageView {
  senderId: string;
  replyToId?: string;
}

interface StoredConversation {
  id: string;
  kind: ConversationKind;
  memberId?: string;
  muted: boolean;
  readAt?: string;
}

export interface MessagingSeed {
  members: MemberCard[];
  conversations: StoredConversation[];
  messages: StoredMessage[];
  notifications: AppNotification[];
}

export interface InMemoryMessagingOptions {
  me: { id: string; name: string };
  seed: MessagingSeed;
  settings: Settings;
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  reject: (code: ApiErrorCode, detail?: string) => Promise<never>;
}

export function createInMemoryMessaging(options: InMemoryMessagingOptions): MessagingApi {
  const { me, seed, settings, clock, ids, respond, reject } = options;
  const { members, conversations, messages, notifications } = seed;
  const now = () => clock.now().toISOString();
  const pushDevices = new Set<string>();
  const member = (id: string) => members.find((m) => m.id === id);
  const find = (id: string) => conversations.find((c) => c.id === id);
  const unread = (conversation: StoredConversation) =>
    messages.filter((m) => m.conversationId === conversation.id && m.senderId !== me.id && (!conversation.readAt || m.createdAt > conversation.readAt)).length;

  const summary = (conversation: StoredConversation): ConversationSummary => {
    const own = messages.filter((m) => m.conversationId === conversation.id);
    const last = own[own.length - 1];
    const other = conversation.memberId ? member(conversation.memberId) : undefined;
    return {
      id: conversation.id,
      kind: conversation.kind,
      title: conversation.kind === ConversationKind.Team ? TEAM_TITLE : (other?.name ?? ''),
      photoUrl: other?.photoUrl,
      otherMemberId: conversation.memberId,
      lastMessageAt: last?.createdAt,
      lastMessagePreview: last ? last.text || last.attachment?.fileName || '' : '',
      lastMessageKind: last?.kind,
      lastFromMe: last?.senderId === me.id,
      lastState: last?.senderId === me.id ? MessageState.Sent : undefined,
      unreadCount: conversation.muted ? 0 : unread(conversation),
      muted: conversation.muted,
      blocked: conversation.memberId ? settings.blockedUsers.includes(conversation.memberId) : false,
    };
  };

  const quote = (replyToId: string | undefined): ReplyPreview | undefined => {
    const original = messages.find((m) => m.id === replyToId);
    return original
      ? { id: original.id, kind: original.kind, senderName: original.senderName, fromMe: original.senderId === me.id, text: original.text || original.attachment?.fileName || '' }
      : undefined;
  };

  const view = ({ senderId, replyToId, ...message }: StoredMessage): MessageView => ({ ...message, replyTo: quote(replyToId), fromMe: senderId === me.id });

  const add = (conversationId: string, message: Omit<StoredMessage, 'id' | 'conversationId' | 'fromMe' | 'senderId' | 'senderName' | 'createdAt' | 'state'>) => {
    const conversation = find(conversationId);
    if (!conversation) {
      return reject(ApiErrorCode.NotFound);
    }
    if (conversation.memberId && settings.blockedUsers.includes(conversation.memberId)) {
      return reject(ApiErrorCode.Forbidden, ApiErrorDetail.MemberBlocked);
    }
    if (message.replyToId && messages.find((m) => m.id === message.replyToId)?.conversationId !== conversationId) {
      return reject(ApiErrorCode.Validation, ApiErrorDetail.ReplyTo);
    }
    const stored: StoredMessage = {
      ...message,
      id: ids.next('msg'),
      conversationId,
      senderId: me.id,
      senderName: me.name,
      fromMe: true,
      createdAt: now(),
      state: MessageState.Sent,
    };
    messages.push(stored);
    conversation.readAt = stored.createdAt;
    return respond(view(stored));
  };

  const open = (kind: ConversationKind, memberId?: string) => {
    const existing = conversations.find((c) => c.kind === kind && c.memberId === memberId);
    if (existing) {
      return existing;
    }
    const created: StoredConversation = { id: ids.next('cnv'), kind, memberId, muted: false };
    conversations.push(created);
    return created;
  };

  return {
    inbox: () =>
      respond({
        unreadMessages: conversations.reduce((sum, c) => sum + (c.muted ? 0 : unread(c)), 0),
        unreadNotifications: notifications.filter((n) => !n.read).length,
        latest: notifications.filter((n) => !n.read).slice(0, 5),
      }),
    notifications: () => respond([...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    async readNotifications(ids) {
      notifications.forEach((n) => {
        if (!ids || ids.includes(n.id)) {
          n.read = true;
        }
      });
      return respond(undefined);
    },
    searchMembers: (query) => {
      const typed = query.trim().toLowerCase();
      if (typed.length < MIN_QUERY) {
        return respond([]);
      }
      return respond(members.filter((m) => m.id !== me.id && !settings.blockedUsers.includes(m.id) && m.name.toLowerCase().includes(typed)));
    },
    getMember: (id) => {
      const found = member(id);
      return found ? respond(found) : reject(ApiErrorCode.NotFound);
    },
    conversations: () =>
      respond(
        conversations
          .filter((c) => c.kind === ConversationKind.Team || messages.some((m) => m.conversationId === c.id))
          .map(summary)
          .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')),
      ),
    start: (memberId) => (member(memberId) ? respond(summary(open(ConversationKind.Direct, memberId))) : reject(ApiErrorCode.NotFound)),
    team: () => respond(summary(open(ConversationKind.Team))),
    messages: (conversationId) => {
      const conversation = find(conversationId);
      if (!conversation) {
        return reject(ApiErrorCode.NotFound);
      }
      return respond({ conversation: summary(conversation), messages: messages.filter((m) => m.conversationId === conversationId).map(view), hasMore: false });
    },
    sendText: (conversationId, text, replyToId) =>
      text.trim() ? add(conversationId, { kind: MessageKind.Text, text: text.trim(), replyToId }) : reject(ApiErrorCode.Validation, ApiErrorDetail.MessageText),
    sendAttachment: (conversationId, attachment) =>
      add(conversationId, {
        kind: attachment.kind,
        text: attachment.text ?? '',
        replyToId: attachment.replyToId,
        attachment: {
          url: attachment.file.uri ?? MEMORY_FILE,
          fileName: attachment.file.name,
          contentType: attachment.file.type,
          sizeBytes: attachment.file.size ?? 0,
          durationSeconds: attachment.durationSeconds,
        },
      }),
    async read(conversationId) {
      const conversation = find(conversationId);
      if (conversation) {
        conversation.readAt = now();
        notifications.forEach((n) => {
          if (n.targetId === conversationId) {
            n.read = true;
          }
        });
      }
      return respond(undefined);
    },
    async mute(conversationId, muted) {
      const conversation = find(conversationId);
      if (conversation) {
        conversation.muted = muted;
      }
      return respond(undefined);
    },
    async block(memberId, blocked) {
      settings.blockedUsers = blocked ? [...settings.blockedUsers.filter((id) => id !== memberId), memberId] : settings.blockedUsers.filter((id) => id !== memberId);
      return respond(undefined);
    },
    async setDiscoverable(discoverable) {
      settings.discoverable = discoverable;
      return respond(undefined);
    },
    async registerPushDevice(device) {
      pushDevices.add(device.token);
      return respond(undefined);
    },
    async unregisterPushDevice(token) {
      pushDevices.delete(token);
      return respond(undefined);
    },
  };
}

export function messagingSeed(at: (days: number) => string): MessagingSeed {
  const karim: MemberCard = { id: 'usr_karim', name: 'Karim Hasan', headline: 'Backend engineer at Northwind Labs' };
  const nadia: MemberCard = { id: 'usr_nadia', name: 'Nadia Islam', headline: 'QA engineer' };
  return {
    members: [karim, nadia],
    conversations: [{ id: 'cnv_karim', kind: ConversationKind.Direct, memberId: karim.id, muted: false }],
    messages: [
      {
        id: 'msg_karim_hello',
        conversationId: 'cnv_karim',
        senderId: karim.id,
        senderName: karim.name,
        kind: MessageKind.Text,
        text: 'Hi Ayesha, our team is hiring a frontend engineer. Interested?',
        fromMe: false,
        createdAt: at(-1),
      },
    ],
    notifications: [
      {
        id: 'ntf_1',
        kind: NotificationKind.Message,
        title: karim.name,
        body: 'Hi Ayesha, our team is hiring a frontend engineer. Interested?',
        target: NotificationTarget.Conversation,
        targetId: 'cnv_karim',
        createdAt: at(-1),
        read: false,
      },
    ],
  };
}
