# Seed Data

CareerPilot has **no seed data**. Every environment (local, Docker, dev, CI, staging, production) starts empty: no sample users, admins, jobs, job sources, applications, or audit history. The Product Owner decided this on 2026-10-27 so the product is always tried the way a real person meets it (spec: `specs/E11-fresh-start/`).

## 1. What the system needs to run

These are product defaults, not sample data, so they live in `config/` like every other default:

| Data | Where |
|---|---|
| Enum catalog (label key, colour tone, order, terminal, active) | `config/defaults/enum-values.yaml`, served in public config as `enumValues` |
| Default tracks for a new account (remote, international sponsored, Bangladesh onsite, Bangladesh government; each "approve each") | `config/defaults/tracks.yaml` |
| Platform settings until a Super Admin saves them (active theme, daily application cap, approval validity, deletion grace, link lifetime) | `config/defaults/platform.yaml`, `ui.yaml`, `account.yaml`, `account-links.yaml` |
| Job sources | None. Sources are added by admins; `discovery.sources` is empty by default. |

## 2. The first Super Admin

- The owner's email address goes in `.env` as `CAREERPILOT_OWNER_EMAIL` (never committed; production uses the secret store).
- When the admin API starts and no admin exists, it creates a pending Super Admin for that address and emails a link to choose the password (same lifetime, single use, and token rules as user links). Once any admin exists, the setting is ignored.
- An expired link is replaced from the admin app: **Forgot password?** on the sign-in page.

## 3. Everyone else

- People create user accounts themselves through registration by email link (requirements §13).
- Super Admins manage further admin accounts in the admin app (requirements §53.2).

## 4. Local data stays

- Data created locally is never reset, re-seeded, or deleted by tooling. `docker compose up --build` keeps the database volume; nothing writes rows at start-up except the owner invitation above.
- Resetting a local database is a deliberate act by the owner (back up first: `pg_dump`).

## 5. Test data

- Unit tests build their own data. Backend tests load `services/core/tests/fixtures/sample-data.json` and the discovery fixtures in `services/core/tests/fixtures/discovery/` through `careerpilot.testing`, injected with `ContainerOverrides`; TypeScript tests use the in-memory API test doubles in `packages/api-client`.
- Test data never ships in an image (`services/*/tests` is excluded from the Docker context) and no environment loads it.
