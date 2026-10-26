# E07 Contact verification — Requirements

**Requirement IDs:** §2 Profile — contact details ("add, verify (code by email or SMS), edit, reorder, and remove"), §53 security defaults, Design/16 Redis key 9 (verification codes)

## User stories

- As a job seeker, I can prove an email address on my profile is mine, so CareerPilot can use it for applications and notifications.
- As a job seeker, I see clearly which contacts are verified.

## Acceptance criteria

- WHEN the user asks to verify an unverified email contact THE SYSTEM SHALL email a numeric one-time code to that address and show where it was sent (masked) and when a new code can be requested.
- WHEN the user enters the correct code before it expires THE SYSTEM SHALL mark the contact verified and discard the code.
- WHEN the code is wrong THE SYSTEM SHALL say so; after the configured number of wrong attempts THE SYSTEM SHALL discard the code and require a new one.
- WHEN the code has expired THE SYSTEM SHALL say so and offer a new code.
- THE SYSTEM SHALL enforce a resend cooldown and an hourly send limit per contact.
- WHEN the coordination store (Redis) is unavailable THE SYSTEM SHALL refuse to send or check codes (fail closed).
- THE SYSTEM SHALL store only a keyed hash of the code, never the code itself, and never log or return the code.
- WHEN a contact's value changes THE SYSTEM SHALL mark it unverified.
- Phone verification needs an SMS provider; until one is configured THE SYSTEM SHALL not offer it and SHALL reject requests with a clear reason.
- THE SYSTEM SHALL never send real email from local, dev, test, staging, or CI (sandbox sender, Mailpit).
