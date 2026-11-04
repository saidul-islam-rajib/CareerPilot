# E26 Students and academics — Design

## Decisions (recommended choices, per CLAUDE.md)

- **Module:** `careerpilot.academic` with models, enums, config, ports, adapters (in-memory, SQL), and small services: programs, tests, credentials, referees and recommendations, outreach, decisions and checklist, planner (plan, budget, warnings), overview.
- **Storage:** one table `academic_records` (id, user_id, record_kind, document JSON, audit columns, soft delete). One generic repository serves programs, tests, credentials, referees, recommendations, outreach and per-user settings.
- **Opportunities:** discovery already has `masters`, `phd`, `scholarship`, `internship` opportunity types. A program is the user's own tracking record, optionally linked by `opportunityId`; `POST /programs/from-opportunity` copies the visible facts and leaves requirements as not stated.
- **Evidence:** every requirement carries `explicit | not_stated | unclear | conflicting`. Nothing is inferred; funding is "stated" only when the user records it as stated.
- **Tests:** score expiry = release date (or test date) plus validity months from `config/defaults/academic.yaml`; the user may override validity. Warnings compare expiry to each linked program deadline and start date.
- **Credentials:** original scale and value only; `convertedValue` is allowed with `conversionSource` (`official | estimate`) and is shown as an estimate otherwise.
- **Referees (REQ-40.3):** a referee needs `consentConfirmedOn`, set only by `PUT /referees/{id}/consent {confirmed:true}`; without it attaching to a program, drafting a request and authorizing a portal invite are refused. Withdrawing consent clears the date and blocks further use. A recommendation reaches `submitted` or `received` only with evidence: `institution_confirmation` or `user_statement` plus a note.
- **Outreach:** drafts come from the catalog template, the profile name and headline, and the supervisor's work text provided by the user. The product never sends; the user sends and then records it. Limits per day, department and university come from config and can be lowered by the user (`PUT /settings`). A decline or "do not contact" stops all further outreach to that supervisor.
- **Portal:** `PortalApplication` on the program: account label (never a password), sections, documents, invited referees (each user-authorized), fee status with evidence, submission status (`not_started`, `in_progress`, `submitted_by_user`, `confirmed_by_institution`), privacy notice link, pending institution items. `blockers` are computed.
- **Decisions:** decision kind, conditions with deadlines, acceptance and deposit deadlines, deferral and scholarship acceptance notes. `POST .../decision/actions {action, confirmed:true}` records accept, deposit paid or decline as user actions. A message draft comes from the catalog. Comparison uses stated numbers; derived totals are `estimated`.
- **Checklist:** steps from config (admission document, proof of funds, visa, insurance, accommodation, tuition, travel, arrival registration); each item keeps the user's official source URL and checked date; the UI always shows the information-only notice.
- **Planner:** backward plan from each deadline using lead days in config; budget groups amounts by currency and by source (`official`, `estimate`).
- **Safety:** no network access, no mail, no portal access. Never log or return secrets.

## API (camelCase JSON, user app `/v1/academic`)

`GET /reference`, `GET /overview`, `GET|PUT /settings`; `GET|POST /programs`, `POST /programs/from-opportunity`, `GET|PUT|DELETE /programs/{id}`, `GET /programs/{id}/plan`, `PUT /programs/{id}/decision/actions`, `GET /programs/{id}/decision/message`, `POST /programs/{id}/checklist`; `GET|POST /tests`, `PUT|DELETE /tests/{id}`; `GET|POST /credentials`, `PUT|DELETE /credentials/{id}`; `GET|POST /referees`, `PUT|DELETE /referees/{id}`, `PUT /referees/{id}/consent`; `GET|POST /recommendations`, `PUT|DELETE /recommendations/{id}`, `GET /recommendations/{id}/draft`; `GET|POST /outreach`, `PUT|DELETE /outreach/{id}`, `POST /outreach/{id}/sent`, `POST /outreach/{id}/reply`; `GET /offers/compare`.

Portal, decision, checklist and budget are parts of the program document and are saved with `PUT /programs/{id}`.

No admin area is needed in version 1 (see tasks).

## UI

Web `/students` (overview, tabs: programs, tests, credentials, referees, outreach), `/students/programs/[id]` (requirements, deadlines, plan, portal, decision, checklist). Mobile equivalents. States: loading, empty, error.
