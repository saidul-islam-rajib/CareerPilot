# E05 Submission engine — Design

- `candidate.submission_checks`: chain of checks (`EMAIL_CHECKS`) over a `SubmissionCase`; `FAILURE_STATUS` maps each `CheckFailure` to a status; reasons from `submission.failures.*`.
- `platform.email_delivery`: `EmailSender` port; `SmtpEmailSender` (sandbox guard: in `delivery_mode: sandbox` only `sandbox_hosts` are allowed); `InMemoryEmailSender` for tests. Failures are classified as retryable, permanent, or uncertain (`DeliveryUncertainError` → "Outcome unknown", never resent).
- `candidate.services.submission.SubmissionService`: `due()`, `submit(user, application)`, `confirm_sent()`. Holds (`SubmissionHold`) keep the application queued. Email route sends the approved CV version (`materials.cv.document_id`) with the generated cover letter; other routes become "Manual action required".
- `ApprovalService.prepare` generates the cover letter from `applications.coverLetter`; `approve_by_rule` is called by recommendations for tracks in automatic mode.
- Workers: `SubmissionWorkflow` (task queue `submission`, schedule every `workers.submission_interval_minutes`), activities `due_applications`, `submit_application`, `confirm_sent`, one at a time.
- Config: `config/defaults/submission.yaml`; Docker sets `CAREERPILOT_SMTP_HOST=mailpit`.
