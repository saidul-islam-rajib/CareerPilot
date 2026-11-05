# E29 Portal autopilot — Requirements

**Requirement IDs:** REQ-10.1, REQ-10.3, REQ-10.4, REQ-10.6, REQ-20.2, REQ-23.2, REQ-27.3, REQ-27.4, REQ-29, REQ-30.

## Scope

Once a user turns on Autopilot, CareerPilot opens the employer's career page in a real browser, signs in or creates the portal account when needed, fills the form from verified profile facts and approved answers, uploads the approved CV, submits and records evidence. Anything that must stay with the user (Section 27.3) becomes Manual action required with the exact reason, the official link and the prepared answers, and can be resumed without creating a duplicate application.

## User stories

- As a job seeker, I want one Turn on Autopilot setup that shows what may be submitted so that I am never asked per job afterwards.
- As a job seeker, I want a list of the portal accounts CareerPilot made for me, with view, export and delete, so that I stay in control of them.
- As a job seeker, I want a clear reason and a prepared checklist whenever a site needs me so that I can finish quickly and resume.
- As an admin, I want to approve or block each employer host so that automation only runs where terms allow it.
- As the owner, I want a read-only readiness check on any job link so that I can see whether a site can be auto-applied before turning real applying on.

## Acceptance criteria

- WHEN Autopilot has not been turned on THE SYSTEM SHALL leave portal jobs at Manual action required (Finish on the employer's site).
- WHEN the user turns Autopilot on THE SYSTEM SHALL show the Section 10.1 summary once, require acknowledgement, record account email, allow-account-creation, terms and privacy checkbox acceptance and the email verification consent, and then not ask per job.
- WHEN a rule sets its own account permissions THE SYSTEM SHALL use them, otherwise the Autopilot defaults.
- WHEN the host is blocked or still in review THE SYSTEM SHALL stop with the host reason and make no request beyond the read-only open check.
- WHEN the live switch is off THE SYSTEM SHALL only open, detect, map and report, SHALL NOT type into the site, create an account or click submit, and the email route SHALL keep using Mailpit.
- WHEN the live switch value is missing, invalid, or the process runs under test or CI THE SYSTEM SHALL behave as off.
- WHEN a sign-in or register wall is shown THE SYSTEM SHALL use a stored portal account first, sign in once, and create an account only if the rule allows it and no account is stored.
- WHEN a sign-in fails THE SYSTEM SHALL mark the account Needs attention, SHALL NOT try again, and SHALL stop with the reason.
- WHEN an account is created THE SYSTEM SHALL generate a unique strong password, seal it in the vault, and never log or return it except in the user's explicit view or export.
- WHEN an email verification link or code is needed THE SYSTEM SHALL read it only from the user's connected Gmail with the verification consent on, from a sender on the portal's domain, within the configured recent window; otherwise it SHALL ask the user.
- WHEN a form field cannot be mapped to a verified fact, approved saved answer or rule-allowed letter THE SYSTEM SHALL stop with Unknown required question and never guess.
- WHEN a choice has no exact match, a demographic question has no explicit answer, a declaration or attestation is shown, or a CAPTCHA, MFA, identity check, assessment, video step or payment appears THE SYSTEM SHALL stop with that reason and notify the user.
- WHEN the portal pre-fills values from the résumé THE SYSTEM SHALL compare them with the profile and overwrite mismatches.
- WHEN submit was clicked and anything fails afterwards THE SYSTEM SHALL record Outcome unknown and SHALL NOT submit again.
- WHEN a confirmation page or number is detected THE SYSTEM SHALL record Confirmed with confirmation text, final URL and screenshot; otherwise Outcome unknown.
- WHEN the user answers a question or resumes THE SYSTEM SHALL continue the same application with the same portal account and SHALL NOT create a duplicate.
- WHEN a host is requested faster than its configured interval or concurrency THE SYSTEM SHALL wait or defer.
- WHEN an admin runs readiness on a URL THE SYSTEM SHALL report wall type, CAPTCHA, mapped and unknown fields and a verdict without writing to the site.
