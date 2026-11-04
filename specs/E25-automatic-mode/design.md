# E25 Automatic mode — Design

## API (user API, `/v1/automation`)

- `GET /v1/automation` overview: rules, effective settings, current holds, today/week counts, skipped records, user-only steps, limits from config.
- `POST /rules`, `PUT /rules/{id}`, `DELETE /rules/{id}` (soft delete), `PUT /rules/order` (drag and drop priority).
- `PUT /settings` deadline buffer hours, deadline action, weekly cap, inactivity days.
- `POST /dry-run` body `{ruleId?}`: simulation only.

## Data

No new table. Rules and settings live in `Preferences.automation` (workspace JSON document, versioned with the user's preferences); rules carry `created_at`, `updated_at`, `deleted_at`. Applications gain `automatic` and `rule_id`. No migration is needed.

Config: `config/defaults/automation.yaml` (max rules, caps, defaults, bounds, user-only step keys). Platform daily cap and emergency stop stay in platform settings (Section 53).

## Precedence (Section 38) in code

`automation/policy.py`: account holds (platform emergency stop, user pause, inactivity), safeguards (hard failure, excluded country, track mode, user-only route, deadline passed, no CV), rule blocks, rule filters, then caps and windows. Submission holds reuse the same policy at send time.

## Deadline buffer

`timing.deadline_at_risk`: the earliest moment all schedules (global window and rule schedule) are open is after deadline minus buffer.

## Events and workers

`SubmissionWorkflow` confirm activity also runs `AutomationService.reconcile()` (cancel stale queued applications, notify deadline risk and inactivity once).

## UI states

Web, mobile: Automatic mode screen with overview (holds, caps), rule list (drag to reorder), rule wizard, dry-run results. Empty state explains the track default. Errors use catalog messages.

## Edge cases and decisions

- Recipient time zone for windows (Section 49.1) is not offered in v1: windows use the user's time zone. Recorded as `- [!]` in tasks.
- Per-track and per-route windows are covered by rule schedule plus track scope on rules; a separate per-route window is not built.
- Pause scopes other than "everything" and the date-range/until pause variants stay as already built (E01 settings); see tasks.
- Profile-freshness pause (Section 41) is not part of this epic.
