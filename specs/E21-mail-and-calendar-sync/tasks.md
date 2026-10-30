# E21 Mail and calendar sync (Google) — Tasks

- [x] Spec, requirements and planning text updated
- [x] Config, enums, models, ports, token vault, OAuth flow
- [x] Google gateway (HTTP) and fake; connection service; routes; migration
- [x] Reply matching, rule-based classifier, sync service, timeline and notifications
- [x] Calendar sync for interview tasks (create, update, cancel, no duplicates)
- [x] Worker schedule and activity
- [x] Admin API connected accounts
- [x] API client, in-memory implementation, client-core hooks, i18n
- [x] Web connected-accounts page, mobile screen, admin card, timeline link
- [x] Runbook `docs/runbooks/google-oauth-setup.md`
- [!] Google verification: the `gmail.readonly` scope is restricted; going beyond 100 test users needs Google's app verification and security assessment (owner action)
- [!] AI classifier: needs `ANTHROPIC_API_KEY`; rules ship first behind the `ReplyClassifier` port
