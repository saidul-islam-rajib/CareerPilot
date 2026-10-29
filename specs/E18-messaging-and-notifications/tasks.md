# E18 Messaging, in-app notifications, and submitted-job tracking — Tasks

- [ ] "I submitted it" for applications finished on the employer's site (service, API, web, mobile)
- [ ] In-app notifications: table, service, inbox endpoint, notify on Submitted and Confirmed
- [ ] Messaging backend: tables and migration, member directory, direct and team conversations, text and attachments, read and delivered receipts, block and discoverable
- [ ] Admin API: team messages, connections, audited conversation view, user files
- [ ] Web app: bell and notifications, chats list, conversation, member search, attachments, voice notes
- [ ] Mobile app: Chats tab, conversation, member search, attachments, voice notes, bell and foreground banner
- [ ] Admin app: Messages and Connections tabs, documents and contacts on the user record
- [!] Device push while the app is closed: needs Firebase (Android `google-services.json`) and Apple push key (needs Apple Developer account). Recommendation: add an Expo push sender behind `NotificationService` once both exist.
