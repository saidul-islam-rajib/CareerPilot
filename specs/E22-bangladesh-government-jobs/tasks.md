# E22 Bangladesh government jobs — Tasks

- [x] Spec
- [x] Backend: enums, config, models, repositories, migration, services, routes (user + admin)
- [x] Backend unit tests (ages, eligibility, tracking, circulars, calendar, connector, persistence)
- [x] API client: types, ports, HTTP, in-memory
- [x] client-core hooks, i18n catalog
- [x] Web screens
- [x] Mobile screens
- [x] Admin screens (circulars, holidays)
- [!] Reference data check: the grade pay scale (National Pay Scale 2015 values) and the freedom-fighter age relaxation suggestion (32) in `config/defaults/government.yaml` come from memory of public sources. Owner: confirm against the current gazette; change only the YAML.
- [!] Holiday data: only fixed-date national days ship in config. Movable holidays must be added each year by an administrator (admin Holidays card). Option A (chosen): admin entry. Option B: import a yearly official list. Recommendation: A until the owner supplies a trusted source.
- [!] Connector accuracy: the Teletalk reader uses generic page text heuristics because the live page structure and terms were not verified from this machine. Owner: check alljobs.teletalk.com.bd terms of use and robots rules, then review drafts against real circulars. The reader never logs in, solves CAPTCHAs or submits.
- [!] Requirement 8.4 allows automatic submission once the user enables it for this track; CLAUDE.md forbids solving CAPTCHAs and the portal requires human verification and an off-platform fee payment. Option A (chosen): guided manual submission only. Option B: automate only portals that offer an official API. Recommendation: A.
- [!] Circular archive (REQ-50): text, fingerprint and per-version snapshots are kept; saved page copies and original PDF/image files are not captured yet. Option A: admin uploads the original files to the circular. Option B: connector saves the fetched HTML. Recommendation: both, in a follow-up.
- [!] Reminders: fee-deadline and stage-date reminders are available as `GET /v1/government/upcoming` and shown in the app; push/email reminders through the notification service and a worker schedule are not wired yet.
