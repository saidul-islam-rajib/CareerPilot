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

> The code and Docker setup are created in the Foundation increment (Sprint 0). These are the commands the project provides once that is done.

Requirements: Docker Desktop (or Docker Engine + Compose), Git, Make. For mobile: Node.js LTS and an Android emulator (Android Studio) or the Expo Go / development build on a phone; iOS Simulator needs a Mac.

```bash
git clone <repository-url> CareerPilot
cd CareerPilot
make setup      # copy .env.example to .env, install tools and git hooks
make up         # start all services, mocks, and Grafana in Docker
make seed       # load reference and demo data for every table
make mobile     # optional: start the Expo dev server for Android/iOS
```

| Service | URL |
|---|---|
| User web app | http://localhost:3000 |
| Admin web app | http://localhost:3001 |
| User API docs | http://localhost:8000/docs |
| Admin API docs | http://localhost:8001/docs |
| Keycloak (sign-in) | http://localhost:8080 |
| Temporal UI | http://localhost:8233 |
| Grafana (logs, traces, metrics) | http://localhost:3100 |
| Mailpit (all local email) | http://localhost:8025 |
| MinIO console (files) | http://localhost:9001 |

Other commands: `make test`, `make test-e2e`, `make test-load`, `make logs`, `make down`, `make reset`.

## Local default credentials

For **local and dev environments only** (never staging or production):

| App | Email | Password |
|---|---|---|
| Admin app (Super Admin) | `admin@sober.com` | `admin@sober.com` |
| User app (demo job seeker) | `admin@sober.com` | `admin@sober.com` |
| Admin and user app, real mailbox (when real email is needed) | `saidul.rajib.online@gmail.com` | `Test@123#` |

More demo accounts (one per persona and admin role) are listed in [Planning/18-Seed-Data.md](Planning/18-Seed-Data.md). All local email is caught by Mailpit unless real sending is enabled in your own `.env`.
