# CareerPilot

Personalized job and graduate opportunity discovery and application assistant.

CareerPilot finds jobs (remote, international with visa sponsorship, Bangladesh on-site, Bangladesh government) and master's/PhD opportunities that match a user's profile, explains each match, and applies on the user's behalf — either after the user approves each application or automatically within rules the user sets. Every application is recorded with the original circular, the exact questions and answers, emails, files, and proof of submission.

It consists of:

| Part | Folder | Technology |
|---|---|---|
| User web app | `apps/web` | Next.js (TypeScript) |
| Admin web app | `apps/admin` | Next.js (TypeScript) |
| Mobile app (Android + iOS) | `apps/mobile` | React Native + Expo |
| Backend APIs and workers | `services/` | Python, FastAPI, Temporal |
| AI | `services/core/.../ai` | Claude API |
| Data | — | PostgreSQL + pgvector, Redis, S3 (MinIO locally) |
| Monitoring | `observability/` | OpenTelemetry + Grafana |

Documentation: [Requirements](Requirement%20Analysis/Requirements.md) · [Planning](Planning/README.md) · [Architecture and design](Planning/Design/README.md) · [Project structure](Planning/17-Project-Structure.md)

## Run locally with Docker

**Step-by-step guide with every command: [RUN-LOCALLY.md](RUN-LOCALLY.md).**

Requirements: Docker Desktop (running) and Git. For mobile: Node.js LTS and an Android emulator or Expo Go on a phone.

```bash
git clone <repository-url> CareerPilot
cd CareerPilot
cp .env.example .env          # local-only defaults, never used outside your machine
docker compose up -d --build  # PostgreSQL, Redis, Mailpit, migrations, user API, admin API, web, admin (starts empty)
```

Stop with `docker compose down` (add `-v` to wipe local data). The mobile app runs with `pnpm install && pnpm --filter @careerpilot/mobile start` (real backend from Docker; `pnpm mobile:demo` for demo data).

| Service | URL |
|---|---|
| User web app | http://localhost:3000 |
| Admin web app | http://localhost:3001 |
| User API docs | http://localhost:8000/docs |
| Admin API docs | http://localhost:8001/docs |
| Mailpit (all local email) | http://localhost:8025 |
| Grafana (with the observability overlay, `admin` / `admin`) | http://localhost:3100 |
| Temporal UI (scheduled discovery) | http://localhost:8233 |

To add logs, traces, and metrics: `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d`. The CareerPilot dashboards are provisioned from `observability/dashboards/`.

Unit tests: `pnpm test` (TypeScript) and `cd services/core && ../.venv/Scripts/python -m pytest` (Python). Enable the git hooks once with `sh scripts/hooks/install.sh`: every commit runs format, lint, type, and unit-test checks for the packages you changed, and every push runs everything. GitHub Actions (`.github/workflows/ci.yml`) runs the same checks plus a secret scan. Keycloak and MinIO join the Compose stack in later increments.

## Run the backend locally

```bash
cp .env.example .env                      # local-only defaults
docker compose up -d postgres             # PostgreSQL 17 with a restricted app role
cd services
python -m venv .venv
.venv/Scripts/python -m pip install -e "core[dev]" -e api
set -a; . ../.env; set +a
(cd core && ../.venv/Scripts/alembic upgrade head)
APP_ENV=http .venv/Scripts/python -m careerpilot_api.dev_server   # user API :8000, admin API :8001
```

`APP_ENV=local` keeps everything in memory (no database needed).

Build the web or admin app with `APP_ENV=http` to use the backend instead of the built-in demo data. Backend tests: `cd services/core && ../.venv/Scripts/python -m pytest`.

## Unattended development (autopilot)

Claude Code works through the open tasks in `specs/*/tasks.md` without stopping. To keep it going across usage-limit resets, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\autopilot.ps1
```

It resumes the latest Claude session, waits and retries when a limit is hit, and stops when all tasks are done or no progress is made. Create `.claude/autopilot-off` to pause. Tasks that need you are marked `- [!]`; tools you need to install are listed in `docs/runbooks/machine-setup.md`.

## Credits

Developed by [Team Sober](https://team-sober.com/). Built with open-source software listed on the in-app open-source licences page.

## Accounts

There are no built-in accounts or sample data; every environment starts empty ([Planning/18-Seed-Data.md](Planning/18-Seed-Data.md)).

- **Admin app:** put the owner's email in `.env` as `CAREERPILOT_OWNER_EMAIL`. On the first start with no admins, that address receives a link to choose the Super Admin password. Lost the link? Use **Forgot password?** on the admin sign-in page.
- **User app:** create an account with **Create account**; the email link lets you choose your password.

All local email is caught by Mailpit unless real sending is enabled in your own `.env` ([docs/runbooks/email-setup.md](docs/runbooks/email-setup.md)).
