# E15 Add a job by link — Requirements

**Requirement IDs:** §27.5 (manual add by link), §7.2, §50

- WHEN a user pastes a job posting link THE SYSTEM SHALL check the address is public `https` (`job_url`), read the posting (schema.org `JobPosting` first, else the page title and main text), and refuse with `job_not_found` when no job can be read.
- THE SYSTEM SHALL keep the job in the shared catalog (deduplicated by address, archived like any listing, warning signs screened) but show it only to the person who added it.
- THE SYSTEM SHALL score it against the user's profile, place it at the top of the best eligible track (the first track when none fits), mark it saved, and open it so the user can apply through the normal approval flow (email route only when the posting asks for applications by email).
- Adding the same link again returns the same job.
