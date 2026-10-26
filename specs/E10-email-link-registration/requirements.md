# E10 Email link registration — Requirements

**Requirement IDs:** §13 Registration by email link and registration consent, §41 Password reset, acceptance item 77, Design/07 §7 User account (`Registered → Active`), Design/16 Redis key 9, Planning/14 §2 (Registration, Password reset)

## User stories

- As a new user, I register with my name and email, receive a link by email, and choose my password from that link, so only the owner of the email address can create the account.
- As a user who forgot my password, I receive a link by email and choose a new password.
- As a user on Android, iOS, or the web, I go through the same steps on every device.

## Acceptance criteria

- WHEN a visitor registers with full name, email, and the required consent THE SYSTEM SHALL create the account in the `registered` state without a password, record the consent (document versions, time, IP, device), and email a single-use link to set the password.
- THE SYSTEM SHALL answer every registration request the same way whether or not the email already has an account; WHEN the email belongs to an account that is not in the `registered` state THE SYSTEM SHALL not change it and SHALL not send a link.
- WHEN the email belongs to an account still in the `registered` state THE SYSTEM SHALL update the name and consent and send a new link that replaces the previous one.
- WHEN a link is opened THE SYSTEM SHALL show who the account is for (name and email) and whether it finishes registration or resets a password; WHEN the link is unknown, used, or expired THE SYSTEM SHALL say so and offer a way to request a new link.
- WHEN the user chooses a password that meets the password policy through a valid link THE SYSTEM SHALL save the password, activate a `registered` account and create its profile, discard the link, and sign the user in.
- WHEN a user requests a password reset for an active or paused account THE SYSTEM SHALL email a reset link; for a `registered` account THE SYSTEM SHALL email a new registration link; the response SHALL be the same for unknown emails.
- WHEN a password is reset through a link THE SYSTEM SHALL end every other session of the account.
- Accounts in the `registered` state SHALL not be able to sign in and SHALL be excluded from discovery, digests, and automation.
- Links SHALL expire after the configured time and work once; only a keyed hash of the link secret SHALL be stored, in the coordination store; resends SHALL be limited by a cooldown and an hourly limit per account; WHEN the coordination store is unavailable THE SYSTEM SHALL refuse the request (fail closed).
- THE SYSTEM SHALL never log or return the link secret, and SHALL never send real email from local, dev, test, staging, or CI (sandbox sender, Mailpit).
- The emailed link opens the set-password page of the user web app, which works on phones and desktops. The Android and iOS apps offer the same register, check-your-email, and set-password screens, and open set-password links that use the app's scheme.
- In demo mode (no backend) THE SYSTEM SHALL send no email; the check-your-email screen SHALL offer the demo link instead.
