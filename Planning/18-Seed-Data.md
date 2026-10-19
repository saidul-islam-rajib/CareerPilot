# Seed Data

Every database table has seed data, so the whole platform can be explored and tested locally right after `make up && make seed`.

## 1. Principles

- **Every table is seeded.** A CI test runs the seeds on an empty database and fails if any table (excluding partition children and pure projections, which are rebuilt from seeded data) has zero rows.
- **Idempotent.** Seeds upsert by natural keys, so running them twice changes nothing.
- **Deterministic.** Generated data uses a fixed random seed, so every developer and agent gets the same data and tests are repeatable.
- **Realistic.** Names, CVs, postings, and circulars look real (including Bangla circular PDFs and scanned images) but are synthetic; no real person's data except the accounts in §3.
- **Safe.** Seeds that create users or credentials refuse to run when `APP_ENV` is `staging` or `production` (only reference data runs there).
- **Owned with the code.** Each bounded context keeps its seed factories in `services/core/src/careerpilot/<context>/seeds/`; shared files (PDFs, images, signatures, photos) live in `seeds/files/`.

## 2. Seed profiles

| Profile | Contents | Used in |
|---|---|---|
| `base` (reference) | Countries, currencies, time zones, opportunity types and schemas, profile field definitions, question groups, platform settings, admin roles and policies, notification templates, feature flags, scoring model v1, country pack (Bangladesh: divisions, districts, upazilas, boards, grades, holidays), mock sources and plugins | All environments (production too) |
| `demo` | Users covering every persona with complete profiles, photos, signatures, multiple emails/phones, documents and versions, tracks, rules, windows, pauses, compensation rules, excluded countries; opportunities of every type and state with archived circulars (English and Bangla, HTML/PDF/scanned); recommendations; applications in **every** submission and outcome status with Q&A, emails, files, evidence; approvals; government stages; academic plans; interviews, offers; payments; notifications; audit events; support tickets; reconciliation issues | Local, dev |
| `scenarios` | Edge cases for automated tests: duplicates, reposts, conflicting deadlines, unclear countries, knock-out questions, outcome unknown, bounced email, expired approval, paused user, deletion grace period | Local, CI |

Commands: `make seed` (base + demo), `make seed-scenarios`, `make seed-reset` (wipe and reseed).

## 3. Local default accounts

These accounts exist in **all local and dev environments** (local Docker, dev, CI). They are never created in staging or production.

| Account | Realm / app | Email | Password | Role |
|---|---|---|---|---|
| Default admin | Admin app | `admin@sober.com` | `admin@sober.com` | Super Admin |
| Default user | User web/mobile app | `admin@sober.com` | `admin@sober.com` | Job seeker with a complete demo profile |
| Real-mailbox admin | Admin app | `saidul.rajib.online@gmail.com` | `Test@123#` | Super Admin (for flows that need a real inbox) |
| Real-mailbox user | User web/mobile app | `saidul.rajib.online@gmail.com` | `Test@123#` | Job seeker (for testing real email delivery) |
| Persona users | User app | `fresh.graduate@sober.com`, `remote.pro@sober.com`, `phd.applicant@sober.com`, `govt.seeker@sober.com`, `paused.user@sober.com`, `deleting.user@sober.com` | `admin@sober.com` | One per persona and lifecycle state |
| Role admins | Admin app | `support@sober.com`, `operations@sober.com`, `readonly@sober.com` | `admin@sober.com` | One per admin role |

Notes:
- Admin and user accounts are separate accounts in separate realms, even with the same email (requirements §53.1).
- The local Keycloak realms use a relaxed password policy so these passwords work; staging and production enforce the full policy.
- Local email goes to Mailpit by default. Only when a developer explicitly enables real email sending in their local `.env` (with their own sending credentials, never committed) does mail reach `saidul.rajib.online@gmail.com`; no mail is ever sent to `@sober.com` addresses.
- The application refuses to start in staging or production if any of these default accounts or passwords exist.
- Production gets its first Super Admin through a one-time bootstrap command using a secret from the secret store, with MFA enrolment required on first sign-in.

## 4. Coverage map (by bounded context)

| Context | Seeded tables (examples) |
|---|---|
| Identity | users, admin_users, roles, policies, sessions, devices, consent_records |
| Profile | profiles, profile_facts, educations, employments, test_scores, referees, links, profile_changes |
| Documents | documents, document_versions (CVs, transcripts, certificates, photos, signatures, a demo video), derived_files |
| Preferences | tracks (4 named + custom), track_settings, excluded_countries, compensation_rules, submission_windows, pauses, auto_rules, auto_rule_versions, reusable_answers |
| Discovery | sources, search_cycles (succeeded, partial, failed), raw_postings |
| Opportunities | opportunity_types, opportunities (every state), opportunity_versions with archived files, fields with evidence, fraud_flags, duplicate_groups |
| Matching | scoring_model_versions, recommendations, match_explanations |
| Applications | applications (every status), application_events, approval_packages, approvals, questions, question_groups, qa_items, submitted_files, email_messages, evidence, payments, portal_accounts, portal_credentials (fake encrypted values) |
| Notifications | notifications, delivery_attempts (delivered, failed, fallback), templates, digests, reports |
| Academic, government, tracking | academic plans, test registrations, referee requests, outreach; govt stages, fee payments, admit cards; interviews, assessments, offers, contacts, tasks |
| Operations | audit_events, outbox_events, inbox_events, reconciliation_runs and issues, support_tickets, incidents, platform_settings, feature_flags |
