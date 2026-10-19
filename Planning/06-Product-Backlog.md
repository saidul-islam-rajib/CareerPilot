# Product Backlog (Epics)

Epics for version 1, mapped to requirement sections and increments. In Sprint 0 each epic is split into stories in GitHub Projects, each story carrying requirement IDs and acceptance criteria. All epics are **Must** for version 1.

Platforms: **B** = backend, **AI** = AI tasks, **W** = user web app, **M** = mobile app, **A** = admin app.

| ID | Epic | Requirement sections | Platforms | Increment |
|---|---|---|---|---|
| E01 | Foundation: repo, CI/CD, environments, auth, design system, API skeleton, observability, audit base | 13, 15, 41, 43, 53.1 | B W M A | 0 |
| E02 | Onboarding and profile: sign-up, guided onboarding, profile CRUD, résumé import, change history, undo | 5.1, 17, 19.3, 46.1 | B AI W M | 1 |
| E03 | Documents: library, versions, validation, conversion, photo/signature resizing | 19, 32.2 | B W M | 1 |
| E04 | Tracks and preferences: ten tracks, per-track settings, filters, excluded countries, compensation rules | 5.2, 5.3, 6, 48, 51 | B W M | 1 |
| E05 | Sources and discovery: registry, connectors, schedules, coverage, manual add by link/file | 7.1, 7.2, 18, 27.5 | B A | 1 |
| E06 | Extraction, archive, dedup: AI extraction, Bangla/PDF/scan, versions, circular archive, duplicates, fraud flags | 7.3–7.6, 42, 50 | B AI | 1 |
| E07 | Matching and dashboard: hard filters, scoring, explanations, daily dashboard, digest, recommendation history | 6.1, 11.1, 22, 52.2 | B AI W M | 1 |
| E08 | Notifications: push, WhatsApp, email, quiet hours, fallback, actions from notifications | 11.3, 36 | B W M | 1–2 |
| E09 | Approve-each applications: approval package, edits and reuse, approval expiry, cancel window, bulk approval | 10.1, 37 | B AI W M | 2 |
| E10 | Application routes: email (Gmail/Graph), ATS adapters, portal accounts and credential vault, generic form mapping, guided manual | 10.2–10.6, 29, 30, 31 | B AI | 2 |
| E11 | Records and reports: status model, submission records, Q&A transcripts, evidence, question bank, daily/weekly reports, exports | 11.2, 20, 28 | B W M | 2 |
| E12 | Writing tools: cover letters, tailored CVs, essays, claim check, cross-contamination check | 10.7, 32.1, 32.3, 27.4 | B AI W M | 2–3 |
| E13 | Automatic mode: rules, dry run, precedence, caps, submission windows, pause, emergency stop, deadline buffer, reconciliation, inactivity safety | 10.1, 10.8, 23, 27, 38, 39, 41, 47, 49, 52.3 | B W M A | 3 |
| E14 | Bangladesh: government circulars, grades, age rules, stages, fees, applicant copies, Bangla profile data, local portals | 8.4, 35 | B AI W M | 4 |
| E15 | Students and academics: programs, tests and scores, credentials, referees, supervisor outreach, university portals, decisions, after-admission checklist | 9, 33 | B AI W M | 4 |
| E16 | After applying: inbox and calendar sync, assessments, interviews, offers, rejections, contacts, insights | 11.4, 11.5, 34 | B AI W M | 5 |
| E17 | Admin application: dashboard, management areas, roles, view-as-user, platform settings and stop | 24, 53 | B A | 1 (basic), 5 (full) |
| E18 | Privacy and account: data export, account deletion, confidentiality, consent, third-party data, minors | 13, 40, 46.2 | B W M A | 1 (basic), 5 (full) |
| E19 | Fees and payments tracking: rules, records, receipts, uncertain payments | 10.10 | B W M | 5 |
| E20 | Hardening and launch: security and accessibility (WCAG 2.2 AA) review, beta, Play Store release, acceptance evidence | 14, 15, 25, 43 | All | 5 |
| E21 | Integrations and payment providers: integration hub, webhook gateway, payment provider plugins, partner API foundations | 10.10, 10.11 | B W M A | 5 |
| E22 | Observability and self-healing: OpenTelemetry everywhere, Grafana dashboards and alerts, error tracking, automated triage, runbook remediation, auto-fix pipeline | 15, 24.1–24.3 | All | 0 (foundation), then every increment |
| E23 | AIDLC platform: agent definitions, Docker local platform, mocks, git hooks, CI gates, agent budgets and reports | Planning 10, 13, 14 | All | 0 |

## Story template

```markdown
### <Story title>

**Requirement IDs:** REQ-x.y-nn, ...
**Platforms:** B / AI / W / M / A
**As a** <user | admin>, **I want** <goal> **so that** <benefit>.

**Acceptance criteria**
- [ ] Given ..., when ..., then ...
- [ ] ...

**Notes:** UX link, API changes, edge cases (see requirements Sections 30, 42)
```

## Backlog rules

- The Product Owner orders the backlog. Stories that unblock other platforms (API contracts, shared components) go first in each sprint.
- Every acceptance criterion in requirements Section 16 maps to at least one story, so test evidence can be collected (requirements Section 25.3).
- Corner cases listed in requirements Sections 30, 31, and 42 become explicit acceptance criteria, not "nice to have".
