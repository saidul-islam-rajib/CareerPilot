# E27 — Design

## API (admin, /admin/v1)

- `GET /messages/inbox?q=&cursor=` lists team conversations: user id, name, preview, last message time, unread count.
- `GET /messages/unread` returns `{count}`.
- `GET /users/{id}/overview` returns the added record sections: contacts, government applications, writing drafts, automation rules, reports, exports, deletion requests, consents, connected accounts (existing), notifications.
- Opening a thread reuses `GET /users/{id}/messages` (marks read) and `POST /users/{id}/messages` (reply).
- Dashboard gains `unreadMessages`; user rows gain `phone`.

## Data

Team unread is tracked per conversation by the TEAM member read marker already stored; `_notify` is extended so the team member counts as a recipient for user posts. No new tables.

## Dashboard sources of truth

Users and applications: `AdminUserRecords.rows()` and `application_rows()` (accounts and workspaces, merged with directory rows). Opportunities and sources: their repositories merged with the directory. Each count has a unit test with its own data.

## UI states

Inbox: loading, empty ("No messages from users yet"), error, polling. Toast and tab title via a shell hook `useTeamUnread`.

## Edge cases

Empty `createdAt` sorts last and renders a dash. Secrets are listed as metadata only.
