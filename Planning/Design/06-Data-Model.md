# Data Model (Logical and Physical)

Store choices are in [../04-Data-and-Storage.md](../04-Data-and-Storage.md). This document defines conventions and entity relationships.

## 1. Conventions

| Convention | Rule |
|---|---|
| Schemas | One PostgreSQL schema per bounded context (`identity`, `profile`, `documents`, `preferences`, `discovery`, `opportunities`, `matching`, `applications`, `automation`, `portals`, `communication`, `notifications`, `academic`, `countries`, `tracking`, `payments`, `audit`, `administration`, `ai`) |
| Primary keys | `id uuid` (UUIDv7, time-ordered) |
| Tenancy | Every table has `tenant_id uuid not null` (single default tenant in v1) |
| Ownership | User-owned tables have `user_id uuid not null`; row-level security on `(tenant_id, user_id)` |
| Audit columns | `created_at`, `created_by`, `created_by_type` (`user` / `admin` / `system`), `updated_at`, `updated_by`, `updated_by_type` |
| Concurrency | `version int` for optimistic locking (API uses ETag / If-Match) |
| Soft delete | `deleted_at` + purge job; immutable tables don't soft delete (privacy deletion uses redaction) |
| Time | `timestamptz` in UTC; original time zone in a separate `*_tz` column; date-only values as `date` |
| Money | `amount_minor bigint` + `currency char(3)` (+ `period` where relevant) |
| Enums | PostgreSQL enums only for fixed models (status model); otherwise lookup tables or metadata |
| Flexible attributes | `attributes jsonb` validated against a versioned JSON Schema (`schema_key`, `schema_version`) |
| Sensitive columns | Encrypted at field level (`*_enc bytea`) with key reference; searchable via blind index where needed |
| Cross-context references | By ID only; no foreign keys across schemas (keeps contexts separable) |
| Naming | snake_case, plural table names |

## 2. Identity, profile, documents

```mermaid
erDiagram
  TENANTS ||--o{ USERS : has
  USERS ||--|| PROFILES : owns
  USERS ||--o{ SESSIONS : has
  USERS ||--o{ DEVICES : registers
  USERS ||--o{ CONSENT_RECORDS : gives
  PROFILES ||--o{ PROFILE_FACTS : contains
  PROFILES ||--o{ EDUCATIONS : lists
  PROFILES ||--o{ EMPLOYMENTS : lists
  PROFILES ||--o{ TEST_SCORES : lists
  PROFILES ||--o{ REFEREES : lists
  PROFILES ||--o{ PROFILE_CHANGES : history
  USERS ||--o{ DOCUMENTS : owns
  DOCUMENTS ||--o{ DOCUMENT_VERSIONS : versions
  DOCUMENT_VERSIONS ||--o{ DERIVED_FILES : produces
  ADMIN_USERS }o--o{ ROLES : assigned
  ROLES ||--o{ POLICIES : grants

  USERS {
    uuid id PK
    uuid tenant_id
    text status "active|suspended|pending_deletion|deleted"
    text locale
    text time_zone
  }
  PROFILE_FACTS {
    uuid id PK
    uuid user_id
    text field_key "metadata key"
    jsonb value
    text provenance "user|extracted|inferred"
    text verification "unconfirmed|verified"
    int version
  }
  EDUCATIONS {
    uuid id PK
    text institution
    text degree
    text grade_original
    text grade_scale
    date start_date
    date end_date
    text completion "completed|expected"
  }
  DOCUMENT_VERSIONS {
    uuid id PK
    uuid document_id
    int version_no
    text state "draft|reviewed|approved|archived"
    text s3_key
    text sha256
    text mime_type
    date valid_until
  }
```

## 3. Preferences and rules

```mermaid
erDiagram
  USERS ||--o{ TRACKS : configures
  TRACKS ||--o{ TRACK_SETTINGS : has
  USERS ||--o{ EXCLUDED_COUNTRIES : sets
  USERS ||--o{ COMPENSATION_RULES : sets
  USERS ||--o{ SUBMISSION_WINDOWS : sets
  USERS ||--o{ PAUSES : sets
  USERS ||--o{ AUTO_RULES : defines
  AUTO_RULES ||--o{ AUTO_RULE_VERSIONS : versions
  USERS ||--o{ REUSABLE_ANSWERS : approves

  TRACKS {
    uuid id PK
    int position "1..10"
    text name
    text opportunity_type_keys
    text application_mode "approve_each|automatic"
    int result_limit
    bool enabled
  }
  AUTO_RULE_VERSIONS {
    uuid id PK
    uuid rule_id
    int version_no
    text cel_expression
    jsonb limits "volume, fees, routes"
    jsonb approved_materials
    date expires_on
    text state "draft|active|paused|expired|revoked"
  }
  PAUSES {
    uuid id PK
    text scope "all|applications|notifications|track|rule|route"
    uuid scope_ref
    timestamptz starts_at
    timestamptz ends_at "null = indefinite"
  }
  REUSABLE_ANSWERS {
    uuid id PK
    uuid question_group_id
    jsonb answer
    text scope "global|track|country"
    int version
  }
```

## 4. Sources, opportunities, matching

```mermaid
erDiagram
  SOURCES ||--o{ SEARCH_CYCLES : runs
  SEARCH_CYCLES ||--o{ RAW_POSTINGS : fetches
  OPPORTUNITY_TYPES ||--o{ OPPORTUNITIES : classifies
  OPPORTUNITIES ||--o{ OPPORTUNITY_VERSIONS : versions
  OPPORTUNITIES ||--o{ OPPORTUNITY_SOURCE_LINKS : listed_at
  OPPORTUNITY_VERSIONS ||--o{ OPPORTUNITY_FIELDS : extracted
  OPPORTUNITIES ||--o{ FRAUD_FLAGS : flagged
  DUPLICATE_GROUPS ||--o{ OPPORTUNITIES : groups
  OPPORTUNITIES ||--o{ RECOMMENDATIONS : recommended
  SCORING_MODEL_VERSIONS ||--o{ RECOMMENDATIONS : scored_by

  SOURCES {
    uuid id PK
    text connector_key
    jsonb config
    text terms_status "automation_allowed|discovery_only|manual_only"
    text status
  }
  OPPORTUNITIES {
    uuid id PK
    text type_key
    text title
    text organization
    text_array countries
    date deadline_date
    timestamptz deadline_at
    text deadline_tz
    bigint comp_min_minor
    bigint comp_max_minor
    char comp_currency
    text state "active|closing_soon|closed|withdrawn|expired"
    vector embedding
  }
  OPPORTUNITY_VERSIONS {
    uuid id PK
    uuid opportunity_id
    int version_no
    text archive_s3_prefix
    text sha256
    timestamptz captured_at
    bool capture_complete
    int schema_version
  }
  OPPORTUNITY_FIELDS {
    uuid id PK
    text field_key
    jsonb value
    text evidence_text
    text evidence_status "explicit|not_stated|unclear|conflicting"
    numeric confidence
  }
  RECOMMENDATIONS {
    uuid id PK
    uuid user_id
    uuid track_id
    uuid opportunity_version_id
    int position
    numeric score
    jsonb explanation
    text user_action "opened|saved|applied|dismissed|ignored"
  }
```

## 5. Applications

```mermaid
erDiagram
  APPLICATIONS ||--o{ APPLICATION_EVENTS : timeline
  APPLICATIONS ||--o{ APPROVAL_PACKAGES : prepared
  APPROVAL_PACKAGES ||--o{ APPROVALS : decided
  APPLICATIONS ||--o{ QA_ITEMS : answered
  QA_ITEMS }o--|| QUESTION_GROUPS : grouped_in
  APPLICATIONS ||--o{ SUBMITTED_FILES : sent
  APPLICATIONS ||--o{ EMAIL_MESSAGES : thread
  APPLICATIONS ||--o{ EVIDENCE : proves
  APPLICATIONS ||--o{ PAYMENTS : pays
  APPLICATIONS }o--o| PORTAL_ACCOUNTS : uses
  PORTAL_ACCOUNTS ||--o| PORTAL_CREDENTIALS : secured_by

  APPLICATIONS {
    uuid id PK
    uuid user_id
    uuid opportunity_id
    uuid opportunity_version_id "archived circular at application"
    text route_type
    text route_adapter_version
    text submission_status "20.2 enum"
    text outcome_status "20.2 enum"
    text authorized_by "approval|rule"
    uuid auto_rule_version_id
    text idempotency_key
    timestamptz scheduled_for
    timestamptz submitted_at
  }
  APPLICATION_EVENTS {
    uuid id PK
    uuid application_id
    text event_type
    jsonb data
    text actor_type
    timestamptz occurred_at
  }
  QA_ITEMS {
    uuid id PK
    text question_text_verbatim
    text field_type
    jsonb options_offered
    bool required
    jsonb answer_submitted
    text answer_source "profile_fact|reusable_answer|generated|user_input"
    bool user_edited
  }
  SUBMITTED_FILES {
    uuid id PK
    uuid document_version_id
    uuid derived_file_id
    text file_name
    bigint size_bytes
    text sha256
  }
  EVIDENCE {
    uuid id PK
    text kind "confirmation_page|confirmation_number|confirmation_email|sent_receipt|screenshot"
    text s3_key
    text value
  }
  PORTAL_CREDENTIALS {
    uuid id PK
    bytea secret_enc
    text kms_key_ref
    timestamptz last_used_at
  }
```

## 6. Notifications, audit, administration

```mermaid
erDiagram
  NOTIFICATIONS ||--o{ DELIVERY_ATTEMPTS : attempts
  NOTIFICATIONS }o--o| NOTIFICATION_ACTIONS : offers
  TEMPLATES ||--o{ TEMPLATE_VERSIONS : versions
  AUDIT_EVENTS }o--|| AUDIT_EVENTS : prev_hash
  RECONCILIATION_RUNS ||--o{ RECONCILIATION_ISSUES : finds
  PLATFORM_SETTINGS ||--o{ PLATFORM_SETTING_VERSIONS : versions
  OUTBOX_EVENTS }o--|| OUTBOX_EVENTS : ordered
  INBOX_EVENTS }o--|| INBOX_EVENTS : dedup

  NOTIFICATIONS {
    uuid id PK
    uuid user_id
    text category
    text urgency "urgent|normal"
    text channel
    text state "queued|sent|delivered|failed|fallback"
  }
  AUDIT_EVENTS {
    uuid id PK
    text actor_type
    uuid actor_id
    text action
    text target_type
    uuid target_id
    text outcome
    text hash
    text prev_hash
    timestamptz occurred_at
  }
  OUTBOX_EVENTS {
    uuid id PK
    text event_type
    int schema_version
    uuid aggregate_id
    jsonb payload
    timestamptz published_at
  }
```

## 7. Physical design

| Topic | Design |
|---|---|
| Partitioning | Monthly range partitions for `audit_events`, `application_events`, `notifications`, `delivery_attempts`, `raw_postings`, `recommendations`, `outbox_events` |
| Indexes | B-tree on foreign IDs and states; GIN on JSONB attributes and full-text `tsvector`; HNSW on `embedding`; partial indexes for active items (for example `state = 'active'`) |
| Row-level security | Enabled on all user-owned tables; the user API sets `app.user_id` and `app.tenant_id` per transaction; admin API uses a separate role with audited bypass |
| Read models | Materialized views / projection tables for dashboards and admin metrics, refreshed by events or schedules, served from the read replica |
| Search | PostgreSQL full-text (English + simple Bangla configuration) in v1; OpenSearch projection later |
| Migrations | Alembic, expand-and-contract (add → backfill → switch → remove) so deploys never need downtime |
| Retention | Purge and redaction jobs per data class; Object Lock retention aligned with retention policy |
| Archival | Old partitions moved to cheaper storage (S3, Parquet) for analytics after the retention period, if retained |
