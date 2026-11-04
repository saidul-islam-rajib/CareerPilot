# E23 Reports, exports and privacy — Requirements

**Requirement IDs:** REQ-13 (privacy and consent), REQ-28.4 (reports), REQ-40 (confidentiality and third-party data), REQ-42 (minors), REQ-46.2 (account deletion), REQ-53 (admin compliance view), acceptance items 20 and 33.

## User stories

- As a job seeker, I want a daily and a weekly activity report so that I see what the system did for me and what needs my action.
- As a job seeker, I want to export my applications, a report, or one application record as CSV or PDF so that I can keep or print it.
- As a job seeker, I want a full copy of my data (JSON plus my files) so that I can leave with it or review it.
- As a job seeker, I want to delete my account, change my mind during a grace period, and be sure all connected access is revoked.
- As a job seeker, I want to see which consents I gave, when, and change the optional ones at any time.
- As an administrator, I want to see export and deletion requests and consent records so that compliance work is possible, without ever seeing secrets.

## Acceptance criteria

- WHEN the user opens a daily or weekly report THE SYSTEM SHALL show submitted, confirmed, failed and waiting-for-user counts for the day or week in the user's time zone, a row per application with a link to its record, and for the week totals by track, route and status, responses received and upcoming deadlines, interviews and exams.
- WHEN the weekday of the weekly summary arrives THE SYSTEM SHALL add the weekly summary to the user's digest email (digest rules: only for active users, local time, sandbox delivery locally).
- WHEN the user requests an export of applications, a report or one application THE SYSTEM SHALL produce a CSV or PDF file asynchronously and offer it through a signed link that expires.
- WHEN the user requests a full data export THE SYSTEM SHALL require the password again, build a ZIP (JSON sections, a manifest and the user's files) asynchronously, never include password hashes, tokens or sealed credentials, and offer it through a signed expiring link; after the retention period the file content is erased and the request shows as expired.
- WHEN more exports are requested than the configured limits allow THE SYSTEM SHALL refuse with a validation error and keep the running ones.
- WHEN the user requests account deletion THE SYSTEM SHALL require the password again, show what is erased, what is kept and why, and what the product cannot delete; stop every automatic application, email, sync and push immediately (account becomes pending deletion); revoke Google connections; and schedule anonymization after the grace period set by the Super Admin.
- WHEN the user cancels during the grace period THE SYSTEM SHALL restore the account to active and record the cancellation. Google must be connected again by the user.
- WHEN the grace period ends THE SYSTEM SHALL send a final confirmation email to the original address, then anonymize the account: name, email, profile, documents, answers, applications, messages and devices lose their personal content, nothing can be linked back to the person, and a minimal record that the deletion happened stays.
- WHEN anyone registers THE SYSTEM SHALL append consent records for the Terms and Privacy Policy (version, time, IP, device); optional consents (analytics, precise location, marketing, use of data to improve AI) are off by default and each change adds a new record. History is append-only.
- WHEN an administrator opens compliance views THE SYSTEM SHALL list export requests, deletion requests and a user's consent history with status and times, require the users read permission, record the view in the audit log, and expose no file keys, links, tokens or password data.

## Out of scope for this slice (marked [!] in tasks.md)

- Excluded organizations (current employer), private lock-screen notifications, referee agreement confirmation (REQ-40.1, 40.3) touch matching and the profile editors; they follow in their own epic.
- Minimum age and guardian consent (REQ-42): the minimum age is still an open question (REQ question 48).
