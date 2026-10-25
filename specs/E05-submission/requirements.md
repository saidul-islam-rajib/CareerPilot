# E05 Submission engine — Requirements

**Requirement IDs:** §20.2 Status model, §23.2 Retries and unknown outcomes, §27.1 Pipeline, §27.2 Global controls, §27.3 User-only steps, §27.4 Pre-submission checks, §47 Pause, §49 Submission timing

## User stories

- As a job seeker, when I approve an application (or my automatic rule approves it), CareerPilot submits it for me through the right route and records proof.
- As a job seeker, I see exactly why an application was not submitted, and what I need to do.

## Acceptance criteria

- WHEN an application is approved THE SYSTEM SHALL prepare a cover letter for that employer and role from the catalog template and attach the approved CV version.
- WHEN a queued application is due THE SYSTEM SHALL run the pre-submission checks (correct target and no text for another employer, CV present and readable PDF, no placeholders, valid recipient, deadline not passed, not already applied, within the daily cap) and stop only that application on failure, recording the reason.
- WHILE an emergency stop or the user's pause is active, or outside the user's submission window, or over the daily cap THE SYSTEM SHALL keep the application queued and not submit.
- WHEN the route is email THE SYSTEM SHALL send the email with the CV attached and record the sent email, files, evidence, and timeline; the status becomes "Submitted – awaiting confirmation" and "Confirmed" after the bounce window without a bounce.
- WHEN the route is a portal THE SYSTEM SHALL mark "Manual action required" and explain the user-only step.
- WHEN sending fails before the message is accepted THE SYSTEM SHALL retry up to the configured attempts, then mark "Failed"; WHEN the outcome cannot be known THE SYSTEM SHALL mark "Outcome unknown" and never resend.
- THE SYSTEM SHALL never send real email from local, dev, test, staging, or CI: in sandbox mode the sender refuses any host other than the configured sandbox hosts (Mailpit).
- WHEN a track is in automatic mode THE SYSTEM SHALL approve new qualified recommendations by rule (not those with a hard failure) and record that the rule approved them.
