# E23 Reports, exports and privacy — Design

## Decisions

- **One module** `careerpilot.privacy` (own enums, models, ports, adapters). Services: `ReportService`, `ExportService`, `DeletionService`, `ConsentService`, `AdminPrivacy`.
- **Reports** are computed from the user's applications on demand (no stored copy). Day and week boundaries use the user's time zone; weeks start on `privacy.reports.week_starts_on`. A row belongs to a period when it was applied or last updated in it.
- **Exports are jobs.** `ExportRequest` rows go `queued -> running -> ready | failed`, and `ready -> expired` after `privacy.exports.retention_hours`. A `JobRunner` port runs them: `BackgroundRunner` (thread pool) after the request, `DirectRunner` in tests; the Temporal `PrivacyWorkflow` (every `workers.privacy_interval_minutes`) is the safety net that processes anything left queued, expires old files and anonymizes due deletions.
- **Files** go through `FileStorage` under `privacy.exports.storage_prefix/<user>/<id>`; links are made by the existing `FileLinkSigner` (expiring HMAC); the file route sends `attachment` for that prefix. Expiry erases content by writing an empty file (no physical delete).
- **Formats:** CSV (columns from config), PDF (a small dependency-free text PDF writer, Latin text; other scripts are replaced with `?` in PDF, CSV keeps UTF-8), ZIP archive. Archive sections are listed in config; credentials, password hashes, tokens and sealed token blobs are never included (a unit test walks the archive).
- **Re-authentication** (REQ-41): full export and deletion take the current password in the body; `invalid_credentials` on mismatch.
- **Deletion states** `requested -> cancelled | completed`. Requesting sets the account `pending_deletion` (digests, rules, sync already skip non-active accounts; sign-in stays allowed so the user can cancel), removes Google connections (revoking at Google), and stores a `DeletionRecord`. Anonymization replaces name and email with a placeholder at `privacy.deletion.anonymized_email_domain`, makes the password unusable, clears the workspace (profile, preferences, applications, answers, sign-in events), erases stored files by overwriting, removes push devices, sets the account `deleted`, and keeps the minimal `DeletionRecord` plus consent records and audit events (listed in config as retained, with reasons and retention days).
- **Consent** is an append-only table; the current state is the newest record per kind. Required kinds (terms, privacy) are written at registration; optional kinds change through the API and default to not granted.
- **Existing stub replaced:** `PreferencesService.request_account_deletion` and `CandidateWorkspace.deletion_scheduled_for` are removed in favour of the new service.

## Data (audit columns and soft delete on every table)

- `data_exports`: `id`, `user_id`, `kind`, `format`, `status`, `document` (period, date, application id, file key, name, size, expires_at, failure).
- `account_deletions`: `id`, `user_id`, `status`, `document` (requested, scheduled, cancelled, completed times).
- `consent_records`: `id`, `user_id`, `kind`, `document` (granted, version, at, ip, device, source).

## API

- User: `GET /v1/reports/{daily|weekly}?date=`; `POST /v1/exports`, `GET /v1/exports`, `GET /v1/exports/{id}`; `GET|POST /v1/account/deletion`, `POST /v1/account/deletion/cancel`; `GET /v1/account/consents`, `PUT /v1/account/consents/{kind}`.
- Admin: `GET /admin/v1/privacy/exports`, `GET /admin/v1/privacy/deletions`, `GET /admin/v1/users/{id}/consents`.
