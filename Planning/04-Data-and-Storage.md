# Data and Storage

Which database or store is used for which kind of data, and why.

## 1. Store by use case

| Use case | Store | Why |
|---|---|---|
| Users, profiles, preferences, tracks, rules, opportunities, recommendations, applications, statuses, approvals, question bank, payments, notifications, admin data | **PostgreSQL** | Relational data with strict consistency; transactions are essential for application records and "exactly one record per action" (requirements Section 52) |
| Flexible extracted fields from postings (requirements, benefits, evidence, confidence) | **PostgreSQL JSONB** columns | Postings vary a lot; JSONB keeps flexibility with indexing |
| Semantic matching (profile ↔ opportunity, question ↔ question meaning) | **pgvector** inside PostgreSQL | No extra database to run; HNSW indexes are enough for one platform's volume |
| Free-text search over opportunities, records, question bank | **PostgreSQL full-text search** (with `pg_trgm`) | Good enough for version 1; move to OpenSearch only if needed |
| Documents, CV versions, videos, photos, signatures | **S3 object storage** (encrypted, versioned) | Large binary files; cheap and durable |
| Archived circulars (HTML, PDF, images, attachments) and submission evidence (screenshots, confirmation pages, sent emails) | **S3 with Object Lock** (write-once for a set retention) | Records must not change after capture (requirements Sections 28.2 and 50); deletion is still possible through the privacy process when the user deletes data |
| Portal passwords, OAuth tokens | **PostgreSQL ciphertext + AWS KMS envelope encryption** | Never stored in plain text; never returned by any API (requirements Section 53.5) |
| App secrets (API keys, database passwords) | **AWS Secrets Manager** | Rotation, no secrets in code |
| Workflow state (pipelines, approvals, schedules, pauses) | **Temporal persistence** | Durable state for long-running workflows |
| Caches, sessions, rate limits, short locks, idempotency fast checks, verification codes, real-time fan-out | **Redis** (two instances: `redis-cache` and `redis-coord`) | Fast, expiring data; never the source of truth ([Design/16-Redis-and-Caching.md](Design/16-Redis-and-Caching.md)) |
| Audit log | **PostgreSQL append-only table** (insert-only database role, hash chain) | Trustworthy history of user, system, and admin actions |
| Mobile offline copy | **SQLite on device** (expo-sqlite) | Offline viewing of recent records |
| Product analytics | **PostHog** (consented events only) | Kept apart from operational data |
| Admin dashboard figures | **PostgreSQL read replica + materialized views** | Heavy reports don't slow the live system |

## 2. Main entities (first draft)

Detailed schemas are designed per sprint. Core entities:

| Area | Entities |
|---|---|
| Identity | `user`, `admin_user`, `role`, `session`, `device`, `consent_record` (document versions, time, IP, device), `sign_in_event` (time, IP, device, approximate location, method, result) |
| Profile | `profile`, `contact`, `education`, `employment`, `skill`, `test_score`, `identity_detail` (sensitive), `address`, `referee`, `link`, `profile_change` |
| Documents | `document`, `document_version`, `video`, `derived_file` (conversions, resized photos) |
| Preferences | `track`, `track_setting`, `excluded_country`, `compensation_rule`, `submission_window`, `pause`, `notification_setting` |
| Automation | `auto_rule`, `auto_rule_version`, `reusable_answer`, `answer_rule` |
| Sources | `source`, `source_terms`, `search_cycle`, `source_check` |
| Opportunities | `opportunity`, `opportunity_version` (archive pointer + hash), `opportunity_source_link`, `opportunity_field` (extracted value + evidence + confidence), `fraud_flag`, `duplicate_group` |
| Matching | `recommendation`, `match_explanation`, `scoring_model_version` |
| Applications | `application`, `application_event` (timeline), `approval_package`, `approval`, `question`, `question_group`, `answer`, `submitted_file`, `email_message`, `evidence`, `payment`, `portal_account`, `portal_credential` (encrypted) |
| After applying | `assessment`, `interview`, `offer`, `academic_decision`, `follow_up_task`, `contact_person` |
| Government | `govt_stage`, `admit_card`, `fee_payment` |
| Notifications | `notification`, `delivery_attempt`, `digest`, `report` |
| Operations | `audit_event`, `reconciliation_run`, `reconciliation_issue`, `support_ticket`, `incident`, `platform_setting`, `feature_flag` |

## 3. Data rules

- **Every row belongs to a user** (`user_id`) except platform data (sources, opportunities, settings). Postgres row-level security enforces this for the user API. The admin API uses its own role (requirements Section 53).
- **Immutable records.** `application_event`, `evidence`, `submitted_file`, `opportunity_version`, and `audit_event` are insert-only. Corrections are new rows (requirements Section 28.2).
- **Status model.** `application.submission_status` and `application.outcome_status` use the enum from requirements Section 20.2 only.
- **Change history.** All user-editable data writes a history row (old value, new value, who, when) to support undo and "changed by administrator" (requirements Sections 46.1 and 53.5).
- **Soft delete, then hard delete.** Deleted items go to recently deleted, then are purged after the configured period; account deletion purges everything except legally required records (requirements Section 46.2).
- **Money and dates.** Amounts are stored as integer minor units plus currency code. Timestamps are stored in UTC with the original time zone kept separately; date-only deadlines stay date-only (requirements Section 21.1).
- **Original values kept.** Grades, scores, salaries, and dates keep their original scale and text alongside any converted value (requirements Section 15, localization).
- **IDs.** UUIDv7 primary keys (sortable by time, safe to expose).

## 4. Data classification and encryption

| Class | Examples | Protection |
|---|---|---|
| Secret | Portal passwords, OAuth tokens | KMS envelope encryption; never returned by any API; access logged |
| Sensitive personal | NID, passport, date of birth, parents' names, quota status, demographic answers | Column-level encryption; shown only where needed; admin views audited |
| Personal | Name, contact, CV, education, applications, IP addresses, device information, approximate location, sign-in history | Encrypted at rest (RDS/S3), row-level security |
| Platform | Sources, opportunities, settings | Standard encryption at rest |

## 5. Backup, retention, and recovery

- RDS automated backups with point-in-time recovery; daily snapshots copied to a second region.
- S3 versioning and cross-region replication for documents and evidence.
- Restore drills every quarter; reconciliation runs after every restore (requirements Section 52.3).
- Retention periods for documents, snapshots, and history come from requirements Section 54 decisions and are configurable by admins.
