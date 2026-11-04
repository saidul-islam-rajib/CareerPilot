# E25 Automatic mode — Tasks

- [x] Spec, config, enums
- [x] Rule model and validation, soft delete, priority order
- [x] Policy: precedence, filters, caps, windows, deadline buffer, inactivity, user-only steps
- [x] Dry run (no side effects)
- [x] Submission holds for rule caps, weekly cap, inactivity, rule inactive, deadline risk
- [x] Reconciliation and notifications in the submission worker
- [x] API routes and unit tests
- [ ] api-client, client-core hooks, i18n
- [ ] Web screens
- [ ] Mobile screens
- [!] Recipient time zone for submission windows (Section 49.1): option A user time zone only (built), option B per-rule choice with recipient zone from the posting. Recommendation: B in a later sprint, needs reliable posting time zone data.
- [!] Per-route windows (Section 49.1): option A rule schedule filtered by allowed routes (built), option B dedicated route window table. Recommendation: A.
- [!] Profile-freshness pause (Sections 41, 52.3): not built here, needs the confirmation-reminder epic.
