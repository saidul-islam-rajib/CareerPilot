# E11 Fresh start — Requirements

**Requirement IDs:** §53.2 Administrator roles (Super Admins manage admin accounts), Planning/18 Seed Data (replaced), Product Owner decision 2026-10-27

## User stories

- As the Product Owner, I start with an empty system (no sample users, admins, jobs, job sources, or demo data), so I test the product the way a real user meets it.
- As the owner, I receive an email link to choose the first Super Admin password, so no admin account or password has to be written into the code or config.
- As an admin whose link expired, I ask for a new one from the admin sign-in page.
- As the Product Owner, everything I add locally stays across restarts and rebuilds.

## Acceptance criteria

- WHEN the API starts on an empty database THE SYSTEM SHALL create no user, admin, job, job source, application, or audit row.
- WHEN the migrate job runs THE SYSTEM SHALL only apply database migrations.
- WHEN a new account is activated THE SYSTEM SHALL give it the default tracks from `config/defaults/tracks.yaml` and nothing else.
- WHEN no admin exists and `CAREERPILOT_OWNER_EMAIL` is set THE SYSTEM SHALL create a pending Super Admin for that address and email it a set-password link that lasts the configured link lifetime.
- WHEN the owner sets a valid password from that link THE SYSTEM SHALL activate the Super Admin and sign them in to the admin app.
- WHEN anyone asks for an admin password link THE SYSTEM SHALL email a link only to an existing admin and answer the same way for every address.
- WHEN at least one admin exists THE SYSTEM SHALL ignore `CAREERPILOT_OWNER_EMAIL`.
- Unit tests build their data from test fixtures; no environment (local, Docker, CI, staging, production) loads sample data.
