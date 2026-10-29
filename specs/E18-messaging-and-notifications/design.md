# E18 Messaging, in-app notifications, and submitted-job tracking — Design

## Decisions (recorded per CLAUDE.md "make the recommended choice")

- **Delivery by short polling, not sockets, for v1.** Apps call `GET /v1/inbox` every `messaging.poll_seconds` (and every `messaging.open_conversation_poll_seconds` inside an open chat). It works the same in Expo Go, the Android APK, the iPhone home-screen app, and the web app, needs no sticky sessions, and keeps Redis out of the source-of-truth path. A WebSocket or SSE channel can replace polling later behind the same client hooks.
- **Real tables**, not JSON projections: messages grow without bound. Migration adds `conversations`, `conversation_members`, `messages`, `notifications` with the standard audit columns and soft delete.
- **Privacy:** directory results carry only `id`, `name`, `photoUrl`, `headline`. Email and phone match only exactly (normalized), never by prefix, so the directory cannot be scraped. `Preferences.discoverable` (default true) and per-user blocks.
- **Admin access to member chats** (requirement §53.5): connections are always visible; message contents of member-to-member conversations open read-only and write an `chat.viewed` audit entry.
- **Device push** (OS notifications while the app is closed) is a separate adapter that needs Firebase and APNs credentials; until then notifications appear in the app (bell with badge, list, and a banner while the app is open).

## Data

- `Conversation`: `id`, `kind` (`ConversationKind`: direct, support), `createdAt`, `lastMessageAt`, `lastMessagePreview`.
- `ConversationMember`: `conversationId`, `memberId`, `memberType` (`MemberType`: user, admin, team), `joinedAt`, `lastReadAt`, `lastDeliveredAt`, `muted`. A support conversation has the user plus the team member `team`; any admin with Users permission can read and reply.
- `Message`: `id`, `conversationId`, `senderId`, `senderType`, `kind` (`MessageKind`: text, image, voice, file), `text`, `attachment` (`StoredFile` + `durationSeconds` for voice), `createdAt`, soft delete.
- `Notification`: `id`, `userId`, `kind` (`NotificationKind`: message, team_message, application_submitted, application_confirmed), `title`, `body`, `target` (`NotificationTarget`: conversation, application) + `targetId`, `createdAt`, `readAt`.
- `Block`: stored in the user's workspace preferences (`blockedUsers`), `discoverable` in preferences.

## Services and API

- `MessagingService` (`messaging/service.py`): `directory(user, query)`, `start(user, other_id)` (reuses the direct conversation of the pair), `conversations(user)`, `messages(user, conversation, before)`, `send(user, conversation, text | upload, kind)`, `read(user, conversation)`, `block/unblock`, `team_conversation(user)`.
- `NotificationService` (`messaging/notifications.py`): `notify(user, kind, title, body, target)`, `list(user)`, `read(user, id | all)`, `inbox(user)` → `{unreadNotifications, unreadMessages, latestNotificationId}` and marks pending messages delivered.
- `ApplicationService.record_submitted(user, application)` (portal finished by the user) and a submission listener that notifies on Submitted / Confirmed.
- User API: `GET /v1/inbox`, `GET /v1/notifications`, `POST /v1/notifications/read`, `GET /v1/members?query=`, `GET/POST /v1/conversations`, `GET /v1/conversations/{id}/messages`, `POST /v1/conversations/{id}/messages` (JSON text or multipart file), `POST /v1/conversations/{id}/read`, `POST /v1/members/{id}/block`, `DELETE /v1/members/{id}/block`, `PUT /v1/settings/discoverable`, `POST /v1/applications/{id}/submitted`.
- Admin API: `GET /admin/v1/users/{id}/connections`, `GET /admin/v1/conversations?userId=`, `GET /admin/v1/conversations/{id}/messages` (audited), `POST /admin/v1/users/{id}/messages` (team message), `GET /admin/v1/users/{id}/files` → document links.
- Config `config/defaults/messaging.yaml`: poll intervals, text max length, page size, attachment types and size limits per kind, voice max seconds, directory min query length and result limit.

## Apps

- Web: header bell with unread badge and dropdown; `/messages` (list + conversation, WhatsApp-like bubbles, ticks, attachment picker, voice recorder via MediaRecorder, image preview, PDF link), `/messages/new` member search, `/notifications`.
- Mobile: tab "Chats" with unread badge; `messages/[id]` conversation, member search, attachments via image/document pickers, voice notes via `expo-audio`; bell on Today; foreground banner when a new notification arrives.
- Admin: user record tabs "Messages" (team chat with the user) and "Connections" (members they talk with, open conversation read-only), "Profile and settings" shows contacts and documents with open links.
- Applications: "I submitted it" on Manual action required (with confirmation), timeline entry by the user, notification.
