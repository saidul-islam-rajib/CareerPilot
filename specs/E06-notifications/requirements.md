# E06 Notifications and account settings — Requirements

**Requirement IDs:** §7.2 Search schedule and freshness (daily digest), §11.3 Notifications and reminders, §28.4 Reports, §36 Notifications, approvals, and communication channels

## User stories

- As a job seeker, I get one email a day at a time I choose that tells me what is new, what waits for me, and what was sent.
- As a job seeker, I can turn the digest off or change its time, and change my password, from the web and mobile apps.

## Acceptance criteria

- WHEN the user's local time (their time zone) reaches the chosen digest time and no digest was sent that local day THE SYSTEM SHALL send one digest email.
- THE SYSTEM SHALL include only non-empty sections: new matches since the last digest, approvals waiting (with the approve-by date), applications sent, applications needing attention (failed, manual action, awaiting information, outcome unknown), and opportunities closing soon that were not applied to; each section is capped at the configured item count with a "more" line.
- WHEN no section has content THE SYSTEM SHALL record the day as handled and send nothing.
- THE SYSTEM SHALL send to the primary email contact, else the first email contact, else the account email; the body ends with a link to the app, a reason line, and the Team Sober credit.
- WHEN delivery fails THE SYSTEM SHALL not report the digest as sent and SHALL not retry the same day (no duplicate digests).
- WHEN the user saves a digest time that is not HH:MM THE SYSTEM SHALL reject it; WHEN no time was chosen THE SYSTEM SHALL show and use the configured default time.
- WHEN the user changes the password with a wrong current password THE SYSTEM SHALL say so on the current-password field and keep the user signed in.
- THE SYSTEM SHALL never send real email from local, dev, test, staging, or CI (sandbox sender, Mailpit).
