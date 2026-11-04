# E22 Bangladesh government jobs — Design

## Decisions (recommended choices, per CLAUDE.md)

- **Module:** `careerpilot.government` (models, ports, adapters, `eligibility`, `ages`, `workdays`, `circulars`, `tracking`, `connector`). Rows hold a JSON document like E21: `gov_circulars`, `gov_holidays`, `gov_applications` (audit columns, soft delete, migration `a7c3e9d15b42`).
- **Config:** `config/defaults/government.yaml` (grades and pay scale, profile field names, default maximum age, relaxation suggestions, quota-to-status map, numeric scales and ordered result ranks, office hours, weekend days, recurring holidays, fee rules, limits, connector hosts and keywords, guide steps). Relaxation suggestions are only prefill hints for administrators and are never applied to a user.
- **Age:** exact to the day: eligible when `cutoff <= birth date + max years`. A 29 February birthday turns a year older on 1 March.
- **Verified status:** a special status counts as verified when its profile entry has a supporting document name (the profile has no other verification flag).
- **Eligibility outcomes:** `met`, `not_met`, `unknown` with reason codes (clients map codes to catalog text). Overall = not met if any not met, else unknown if any unknown, else met. Quota claims are `met` (general, or verified status, or matching district) or `unknown`, never `not_met`, because a missing status may only mean it was not entered. Experience is not checked (the profile has no reliable experience duration).
- **Holidays:** recurring fixed-date national days come from config; movable holidays (Eids, Buddha Purnima and others) are not guessed; administrators add them per year (`gov_holidays`). Weekend days and office hours come from config. Deadlines are never shifted automatically, only annotated.
- **Fee:** record only. `FeeRecord` has amount, status (`not_required`, `due`, `unconfirmed`, `paid`), method, deadline, evidence note. The transaction ID is sealed like portal credentials.
- **Secrets:** application ID, portal user ID, password, roll number and transaction ID are sealed with Fernet (key derived from the vault secret with context `government.vault_context`) and returned only by `POST .../secrets/reveal` (`Cache-Control: no-store`).
- **Applicant copy:** uploaded by the user (PDF, PNG, JPEG, size from config), stored in file storage under `gov/<user>/<application>/`, SHA-256 recorded, served through signed links. Removing a copy only removes the reference; the file is never physically deleted.
- **Archive (REQ-50):** each circular keeps its full source text, a fingerprint and a snapshot per version; an application records the version it was created against; `liveRemoved` shows that the live posting is gone. Page and PDF snapshots are not captured (see tasks).
- **Connector:** `TeletalkReader` fetches one HTTPS page on `connector.allowed_hosts` through the existing SSRF-safe fetcher, extracts title, text, a closing date and a fee near configured keywords, and returns a draft (`needsReview`). Posts, quotas, age rules and exams are always entered by an administrator.
- **Guided submission:** `GET .../guide` lists config-ordered steps with `actor` (`user` or `system`) and `done`. The app never submits to the portal.
- **Permissions:** circulars use the Opportunities admin area (read, update; delete for super admins); holidays use Settings.

## API (camelCase JSON)

User: `GET /v1/government/reference`, `GET /circulars?grades=9,10&gradeMin&gradeMax&authority&location&phase&eligibleOnly`, `GET /circulars/{id}` (circular, phase, amended, close note, per-post eligibility), `GET /circulars/{id}/versions/{n}`, `GET|POST /applications`, `GET|DELETE /applications/{id}`, `POST /applications/{id}/submitted`, `/confirmed`, `PATCH .../fee`, `POST|PUT|DELETE .../stages`, `POST|DELETE .../copies`, `PUT .../secrets`, `POST .../secrets/reveal`, `GET .../guide`, `GET /upcoming`.

Admin: `GET /admin/v1/government/reference`, `GET|POST /circulars`, `POST /circulars/import {url}`, `GET|PUT|DELETE /circulars/{id}`, `POST .../publish`, `.../withdraw`, `PUT .../live-removed`, `POST .../notices`, `GET|POST /holidays`, `DELETE /holidays/{id}`.

## UI

- Web `/government` (list with filters, eligibility chips), `/government/[id]` (posts, eligibility breakdown, deadlines with notes, notices, start tracking), `/government/applications/[id]` (guide, fee, stages, copies, credentials). Mobile equivalents. Admin `/government` (circulars and holidays).
- States: loading, empty, error. Drag and drop orders the chosen posts (rank preference) on the circular page.

## Edge cases

- Duplicate tracking of one circular is refused (`conflict`). Withdrawn circulars disappear from lists but keep tracked applications readable.
- An unknown result scale or non-numeric result is `unknown`, never `not_met`.
