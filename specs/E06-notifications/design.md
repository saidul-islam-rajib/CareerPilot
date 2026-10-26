# E06 Notifications and account settings — Design

- `candidate.models.NotificationPreferences` (`digest_enabled`, `digest_time`) inside `Preferences`; `CandidateWorkspace.last_digest_on` (local date) prevents duplicates.
- `candidate.services.digest.DigestService`: `due_users()`, `send_due()`, `sections(user)`, `send(user)`. Section builders return `DigestSection(title_key, lines, total)`; text from the `digest.*` catalog keys; delivery through the `EmailSender` port.
- `PreferencesService.update_notifications` validates the time (`require_time`); reads return the effective time (default from config).
- API: `PATCH /v1/settings/notifications` (`digestEnabled`, `digestTime`), `POST /v1/account/password`.
- Workers: `DigestWorkflow` with activity `send_digests` on the `submission` task queue, schedule `workers.digest_schedule_id` every `workers.digest_interval_minutes`.
- Clients: `SettingsApi.updateNotifications`; shared hooks `useNotificationsForm` and `useChangePasswordForm` (client-core) with schemas `notifications` and `changePassword` (validation); screens `/settings/notifications` and `/settings/password` on web and mobile. The HTTP client signs out only on the `unauthorized` code, not on `invalid_credentials`.
- Config: `config/defaults/notifications.yaml` (`default_digest_time`, `web_base_url`, `max_items_per_section`), `config/defaults/workers.yaml` digest keys.
