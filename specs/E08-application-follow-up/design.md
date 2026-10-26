# E08 Application follow-up — Design

- Enums: `TaskKind` (follow_up, interview, assessment, reference, communication, other), `TaskStatus` (open, done, dismissed); metadata rows in `enum-values.seed.ts`, exported to `seeds/demo/demo-seed.json`.
- Model: `FollowUpTask(id, kind, title, due_at?, location, notes, status, created_at, updated_at)`; `ApplicationRecord.tasks`. Stored in the workspace document (no migration).
- Config `config/defaults/tracking.yaml`: text limits, `upcoming_days`, `follow_up_after_days`; exposed in public config `tracking`.
- `ApplicationService`: `update_outcome`, `add_task`, `edit_task`, `set_task_status`; timeline entries with actor `user` from catalog keys `applications.timelineEvents.*`.
- API: `PUT /v1/applications/{id}/outcome`, `POST /v1/applications/{id}/tasks`, `PUT /v1/applications/{id}/tasks/{taskId}`, `PUT /v1/applications/{id}/tasks/{taskId}/status`; dashboard gains `upcoming`.
- Clients: `ApplicationApi.updateOutcome/addTask/editTask/setTaskStatus`; hooks in client-core; date and time entered as separate fields and converted with the user's time zone (`zonedToIso`, `isoToZoned` in domain-ui-logic). Web: outcome and follow-up cards on the application page, "Coming up" on Today. Mobile: same on the application screen with edit screens.
