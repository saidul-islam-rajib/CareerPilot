# E11 Fresh start — Design

## Backend starts empty

- `repositories.in_memory_repositories` and `sql_repositories` return empty repositories; nothing is seeded when the database is empty. The migrate job runs only `alembic upgrade head`.
- Reference data lives in config: the enum catalog (`config/defaults/enum-values.yaml`, served as `enumValues` in public config), the default tracks for new accounts (`config/defaults/tracks.yaml`; the four named tracks, each starting as "approve each"), and the platform defaults (`config/defaults/platform.yaml` plus `ui.active_theme`, `account.approval_validity_days`, `account.deletion_grace_days`). `SqlPlatformSettingsRepository` returns these defaults until an admin saves settings; `SqlDirectory.operations()` returns an empty snapshot until something is recorded.
- Job sources: `discovery.sources` is empty and `fetch_mode` is `live`; the two mock sources and their fixture files are test fixtures (`services/core/tests/fixtures/discovery/`).
- Test data: `careerpilot.testing` (imported only by tests) loads `services/core/tests/fixtures/sample-data.json` and builds in-memory or SQL repositories from it through `ContainerOverrides.repositories`; `sample_settings()` adds the discovery fixtures. The JSON is exported from the TypeScript test fixtures by `scripts/seeds/export-demo-seed.mjs` so both sides test against the same data.

## First Super Admin by email link

- `.env` holds `CAREERPILOT_OWNER_EMAIL` (config `admin.owner_email_env`), never committed.
- When the admin API starts and no admin exists, it creates a pending Super Admin for that address (empty password hash, so password sign-in is impossible) and emails a set-password link through the account courier; the link uses the same one-time codes, lifetime, cooldown, and token shape as user links, under purpose `admin_link`.
- Admin endpoints: `POST /admin/v1/auth/password-link` (`{email}` → 204, a link only for existing admins), `POST /admin/v1/auth/account-links/inspect` (`{token}` → `{email, fullName}`), `POST /admin/v1/auth/account-links/complete` (`{token, password}` → admin session). Tokens travel in request bodies only.
- Admin app: `/set-password?token=` (set the password, then signed in) and `/forgot-password` (ask for a link), built from the same shared components and catalog text as the user web app.

## Local fresh start

- Back up the local database to a file outside the project, then empty it, the Redis coordination store (sessions and links), and Mailpit, and restart. From then on the local data is never reset, re-seeded, or deleted by tooling (`docker compose up --build` keeps volumes).

## Apps without demo mode

- The in-memory API and its sample data stay as unit-test doubles only; the apps always talk to the API. The mobile `start` script uses the real backend; demo-only scripts and the demo link button go.
