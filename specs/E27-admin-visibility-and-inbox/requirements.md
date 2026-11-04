# E27 Admin visibility and team inbox — Requirements

**Requirement IDs:** REQ-53.3, REQ-53.4, REQ-53.5, REQ-36.1

## User stories

- As an admin, I want every contact of a user (email and phone, with verified and primary flags) on the user record and the phone in the users list, so that I can reach and find any user.
- As an admin, I want the user record to cover everything held about the user (profile, Bangladesh details, photo, documents, job lists, applications and timelines, approvals, sources, tracks, preferences, government job applications, writing drafts, automation rules, reports, export and deletion requests, consents, connected accounts, sessions, notifications, messages), so that support never needs another tool.
- As an admin, I want to be told when a user messages the team, so that no message waits unseen.
- As an admin, I want every dashboard number to come from the real data and to open the filtered list behind it, so that I can trust and trace it.

## Acceptance criteria

- WHEN a user has contacts THE SYSTEM SHALL show all of them with kind, label, value, verified and primary; WHEN there is no phone THE SYSTEM SHALL show "No phone number added".
- THE SYSTEM SHALL let the users list be searched by phone and show the phone.
- THE SYSTEM SHALL NEVER return passwords, tokens, portal credentials or API keys in any admin view (REQ-53.5); only their existence and dates.
- WHEN a user posts to the team conversation THE SYSTEM SHALL count it as unread for admins until an admin opens the thread.
- THE SYSTEM SHALL expose the unread count and a newest-first, searchable list of team conversations with user name, preview and unread count.
- WHEN an admin opens a team conversation THE SYSTEM SHALL return the thread, mark it read, and allow a reply through the existing reply feature.
- WHILE the admin app is open THE SYSTEM SHALL poll at `messaging.poll_seconds`, show a toast and a tab-title count when the unread count rises.
- THE SYSTEM SHALL compute dashboard users, applications, opportunities and sources from the real accounts, workspaces, opportunity and source repositories, never from stale projections only.
- THE SYSTEM SHALL link every dashboard tile to the list filtered the same way.
- THE SYSTEM SHALL render lists without errors when a field such as `createdAt` is empty.
- Email alerts to the team about user messages are not sent from local, dev, test, staging or CI (CLAUDE.md).
