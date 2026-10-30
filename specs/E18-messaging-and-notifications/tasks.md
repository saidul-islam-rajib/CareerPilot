# E18 Messaging, in-app notifications, and submitted-job tracking — Tasks

- [x] "I submitted it" for applications finished on the employer's site (service, API, web, mobile)
- [x] In-app notifications: table, service, inbox endpoint, notify on Submitted and Confirmed
- [x] Messaging backend: tables and migration, member directory, direct and team conversations, text and attachments, read and delivered receipts, block and discoverable
- [x] Admin API: team messages, connections, audited conversation view, user files
- [x] Web app: bell and notifications, chats list, conversation, member search, attachments, voice notes
- [x] Mobile app: Chats tab, conversation, member search, attachments, voice notes, bell and foreground banner
- [x] Admin app: Messages and Connections tabs, documents and contacts on the user record
- [x] Device push on Android while the app is closed: `NotificationService` sends every in-app notification through Expo's push service (`messaging.push` config, `push_devices` table); phones register after sign-in and are forgotten on sign-out or when Expo reports the app uninstalled
- [!] Device push on iPhone: needs an Apple push key, which needs an Apple Developer account. Recommendation: add it in Expo credentials once the account exists; no code change is needed.
