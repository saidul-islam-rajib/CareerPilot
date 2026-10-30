# E21 Mail and calendar sync (Google) — Tasks

- [x] Spec, requirements and planning text updated
- [ ] Config, enums, models, ports, token vault, OAuth flow
- [ ] Google gateway (HTTP) and fake; connection service; routes; migration
- [ ] Reply matching, rule-based classifier, sync service, timeline and notifications
- [ ] Calendar sync for interview tasks (create, update, cancel, no duplicates)
- [ ] Worker schedule and activity
- [ ] Admin API connected accounts
- [ ] API client, in-memory implementation, client-core hooks, i18n
- [ ] Web connected-accounts page, mobile screen, admin card, timeline link
- [ ] Runbook `docs/runbooks/google-oauth-setup.md`
- [!] Google verification: the `gmail.readonly` scope is restricted; going beyond 100 test users needs Google's app verification and security assessment (owner action)
- [!] AI classifier: needs `ANTHROPIC_API_KEY`; rules ship first behind the `ReplyClassifier` port
