# E27 — Tasks

- [x] Spec
- [x] Backend: dashboard counts from real data (accounts, workspaces, listings), unit tests
- [x] Backend: phone in users list and search, user segments (new, automatic, incomplete)
- [x] Backend: team inbox, unread count, unread tile
- [x] Backend: user overview (government applications, writing drafts, automation rules, exports, deletion, notifications)
- [x] API client (HTTP and in-memory), i18n
- [x] Admin: nav badge with polling, inbox page, toast, tab title, dashboard tiles linking to filtered lists
- [x] Admin: contacts card with verified and primary flags and the no-phone state, overview tab, empty dates
- [!] Email alert to the team on new user messages: never sent from local. Option A: add a team-email notification kind behind a production-only switch. Recommendation: A after the owner sets the team address.
- [!] Dashboard date-range, country, track and user filters (requirement 53.3) are not built. Option A: add query filters to the dashboard endpoint. Recommendation: A in a follow-up.
- [!] Notification counts and system health on the dashboard still come from the operations snapshot, not live delivery logs. Option A: count rows in the notifications table and report real health checks. Recommendation: A.
- [!] Problem reports (requirement 44) and student academic records are not shown on the user record: no admin read port exists yet. Recommendation: add read ports with the support and academic follow-ups.
- [!] Sources total counts user-added private sources as well as shared ones. Option A: count shared only. Recommendation: keep, and add a shared/private split in a follow-up.
