# E22 Bangladesh government jobs — Requirements

**Requirement IDs:** REQ-8.4, REQ-8.4.1, REQ-35.2, REQ-50, REQ-27.3, REQ-27.4, REQ-20.2, REQ-38

## User stories

- As a job seeker, I want to browse government circulars with each post, grade, pay scale, quota and vacancies, filtered by grade, agency and place, so that I only look at posts I can apply for.
- As a job seeker, I want each post checked against my Bangladesh profile (age on the circular's cut-off date, exams and results, district, citizenship, quota) with unknown shown as unknown, so that I never rely on assumed facts.
- As a job seeker, I want the application fee, its payment deadline, the exam stages and their dates recorded, so that I do not miss a step after submitting.
- As a job seeker, I want holidays, weekends and office hours flagged on every deadline, so that I know when a bank or office is closed.
- As a job seeker, I want to keep the applicant copy and the portal's ID and password safely, so that I can find them for the admit card.
- As an administrator, I want to add circulars (by hand or as a draft read from a public Teletalk page), publish amendments, and add holidays, so that users see current dates.

## Acceptance criteria

- WHEN a post states a maximum age THE SYSTEM SHALL compute the age as of the circular's own cut-off date, and WHEN no cut-off is stated THE SYSTEM SHALL show age as unknown.
- WHEN the user holds a special status that the post lists as an age relaxation AND the status has a supporting document reference THE SYSTEM SHALL apply the relaxation; WHEN the status has no document reference THE SYSTEM SHALL show age as unknown (relaxation unverified).
- WHEN a profile fact needed for a check is missing THE SYSTEM SHALL mark that check unknown and never assume a value.
- WHEN a circular has several posts THE SYSTEM SHALL show each post with its own grade, pay scale, vacancies, quotas and eligibility.
- WHEN the user starts tracking a circular THE SYSTEM SHALL keep the post order the user chose, record the circular version, and record the fee as due.
- WHEN the user records submission THE SYSTEM SHALL start the payment deadline from the circular's payment window; it SHALL NOT submit or pay anything.
- WHEN the user marks a fee paid THE SYSTEM SHALL require evidence (a transaction ID or an evidence note); otherwise it SHALL refuse.
- WHEN a stage is marked passed or failed from an official notice THE SYSTEM SHALL require the notice link; the user's own entry is also accepted and labelled as such.
- WHEN a deadline falls on a holiday, weekend or outside office hours THE SYSTEM SHALL say so and name the previous and next working day, without moving the deadline.
- WHEN a published circular changes THE SYSTEM SHALL keep the earlier version, bump the version and flag the circular as amended.
- THE SYSTEM SHALL keep portal credentials and transaction IDs encrypted, never return them in ordinary responses or logs, and return them only on an explicit reveal request.
- THE SYSTEM SHALL read only public circular pages on the configured Teletalk host, produce a draft for an administrator to review, and never solve CAPTCHAs, evade bot detection, log in or submit.
- THE SYSTEM SHALL leave verification steps, form submission and fee payment to the user (guided steps).
