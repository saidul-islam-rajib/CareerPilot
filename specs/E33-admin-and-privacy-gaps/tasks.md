# E33 Admin and privacy gaps

Source: specs/REMAINING.md; requirements §53.3, REQ-42.

- [ ] T1 Dashboard filters (date range, country, track, user) as `DashboardFilter` query on `administration/live_figures.py`, `/dashboard` query params, filter bar in the admin dashboard.
- [ ] T2 Live notification counts (stored, read, removed push devices) and system health probes replace the operations snapshot figures.
- [ ] T3 Admin user record Overview tab shows problem reports and academic records through read ports (user opportunity reports shown only if the port exists).
- [ ] T4 Register `academic_records` in the privacy export and anonymization.
- [ ] T5 Super Admin creates and soft-deletes admin accounts and custom roles; new admin gets the password-link email through the existing flow; audited.
- [ ] T6 Minimum age 16 and guardian consent below it: age from `config/defaults/account.yaml`, enforced at sign-up and profile where date of birth is known.

Decisions: no new migration unless a table is missing; extra row fields (`tracks`, `userId`) are additive with defaults; "failed" notifications means push devices removed as unregistered.
