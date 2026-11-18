# E30 Reminders and quiet hours (Requirements 11.3, 28.4, 36, 41, 52.3)

Reminder job: Temporal schedule `ReminderWorkflow` (config `workers.reminder_*`, every 15 minutes) runs `ReminderService.run_due` through `NotificationService`. No migration: state lives in the workspace document (`reminders_sent`, `held_pushes`, `profile_confirmed_at`).

- [x] Quiet hours: user setting (start, end, urgent override) in notification settings; pushes inside the window are held and released by the reminder job; urgent kinds from `config/defaults/reminders.yaml` pass only when the user allows it. In-app list is never delayed.
- [x] Approval expiry reminders at `approval_lead_hours` (48, 12), once per approval and stage.
- [x] Daily application report section in the digest (`digest.daily`) with a link to each record, reusing `ReportService` DAILY.
- [x] One job for government deadlines (`government_lead_days`), fee and payment reminders (from the fees overview) and supervisor replies; key = stage + item + step, sent once.
- [x] Profile freshness: `POST /v1/profile/confirm`, user-defined `freshnessDays` in automation settings, `profile_stale` skips automatic submission until confirmed, confirmation reminder once per period. Clock starts at the first job run (never fabricates a confirmation).
- [x] Web and mobile: quiet hours card, freshness field, confirm button, catalog strings, new notification kinds and targets.
- [!] Section 27.2 deadline buffer does not yet add the quiet-hours delay; recommend adding the longest quiet window to the buffer in a follow-up. Per-day cap on non-urgent notifications not built.
