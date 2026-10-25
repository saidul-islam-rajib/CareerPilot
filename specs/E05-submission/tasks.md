# E05 Submission engine — Tasks

- [x] Cover letter and subject templates; CV document reference on approvals
- [x] Pre-submission checks chain with failure → status mapping and catalog reasons
- [x] Email route adapter (SMTP with sandbox guard) and in-memory sender
- [x] Submission service: holds (emergency stop, pause, window, daily cap), checks, send, retries, outcome unknown, idempotency, confirmation after bounce window, stuck-submission sweep
- [x] Automatic mode approvals by rule
- [x] Temporal SubmissionWorkflow on a schedule (own task queue, one at a time)
- [x] Docker: SMTP to Mailpit; end-to-end check: discovery → match → rule approval → email with CV in Mailpit
- [ ] Inbound bounce processing (move "Confirmed" to "Failed" on a late bounce)
- [ ] Portal routes with browser automation where permitted (ATS adapters)
- [ ] Rule simulation (dry run) and deadline buffer settings (§27.2)
