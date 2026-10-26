# E08 Application follow-up — Requirements

**Requirement IDs:** §20.1 Application records, §20.2 statuses (outcome), §20.3 Follow-ups and reminders, §20.4 Withdrawal and correction, §34.1 Assessments, §34.2 Interviews, §34.4 Rejections and outcomes, §11.1 Daily dashboard

## User stories

- As a job seeker, after an application is sent I record what happened next: under review, assessment, interview, offer, rejection, or that I withdrew.
- As a job seeker, I keep follow-up tasks (follow up, interview, assessment, reference, communication) with a date and time, and see what is coming up on my dashboard.

## Acceptance criteria

- WHEN the user changes an application's outcome THE SYSTEM SHALL record it with an optional note in the timeline as a user action; outcomes the employer caused SHALL update the last-contact date.
- Silence SHALL NOT be recorded as rejection; the outcome stays "No response yet" until the user changes it.
- WHEN the user marks an application withdrawn THE SYSTEM SHALL say clearly that this is recorded in CareerPilot only and does not tell the employer.
- THE SYSTEM SHALL let the user add, edit, complete, reopen, and dismiss follow-up tasks with a kind, title, optional date and time (in the user's time zone), location or meeting link, and notes; completing a task SHALL NOT change the application status.
- WHEN an application has had no response for the configured number of days THE SYSTEM SHALL suggest a follow-up, labelled as a suggestion rather than an official deadline.
- THE SYSTEM SHALL show open tasks due within the configured number of days on the dashboard, soonest first.
- Text lengths SHALL be limited by configuration; every kind and status SHALL be an enum with display metadata.
