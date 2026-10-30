# Local Development: One Solution, One Command

Everything (backend, workers, web, admin, mobile, infrastructure, observability, mocks, tests, docs, and agent definitions) lives in **one solution folder** (this repository). The whole platform runs locally in **Docker**, so anyone, human or agent, can learn, run, and test it in one place.

## 1. Solution folder

The canonical, detailed structure is in [17-Project-Structure.md](17-Project-Structure.md); the summary below shows the parts used for local development. Local default accounts (for example `admin@sober.com`) are listed in [18-Seed-Data.md](18-Seed-Data.md) §3.

```text
CareerPilot/
├── CLAUDE.md                  # Rules for Claude and agents
├── Makefile                   # One entry point for all common tasks
├── docker-compose.yml         # Core services
├── docker-compose.observability.yml
├── docker-compose.tools.yml   # Mock portals, mail catcher
├── .env.example               # All settings with safe local defaults (no real secrets)
├── .devcontainer/             # Ready-made dev environment (VS Code / Codespaces)
├── .claude/
│   ├── agents/                # AIDLC agent definitions
│   ├── skills/                # Project skills (recipes)
│   └── settings.json          # Permissions and hooks
├── Requirement Analysis/      # Requirements
├── Planning/                  # Plans and Design/
├── docs/                      # ADRs, API spec, runbooks
├── apps/                      # web, admin, mobile
├── packages/                  # Shared TypeScript packages
├── services/                  # Python backend, plugins, workers
├── tests/
│   └── fixtures/              # Synthetic users, postings, circulars
├── mocks/                     # Mock job sources, mock ATS portals, mock payment provider, mock WhatsApp
├── observability/             # Dashboards, alert rules, Alloy config
├── infra/                     # Terraform (AWS), Compose files for servers
└── .github/workflows/         # CI/CD
```

## 2. Local services (Docker Compose)

| Service | Purpose | Local URL / port |
|---|---|---|
| `postgres` (with pgvector) | Database | 5432 |
| `redis` | Cache, rate limits | 6379 |
| `minio` | S3-compatible storage | 9000 / console 9001 |
| `temporal` + `temporal-ui` | Workflows | 7233 / UI 8233 |
| `keycloak` | Sign-in (users and admins realms pre-configured) | 8080 |
| `localstack` (SQS, EventBridge, SES, KMS) | AWS services locally | 4566 |
| `user-api`, `admin-api` | Backend APIs (hot reload) | 8000 / 8001 |
| `workers` | All Temporal task queues | — |
| `browser-sandbox` | Playwright browsers | — |
| `embeddings` | Local embedding model | 8100 |
| `clamav` | Antivirus for uploads | — |
| `web`, `admin` | Next.js apps (hot reload) | 3000 / 3001 |
| `mailpit` | Catches all outgoing email (account email reaches real inboxes only when `CAREERPILOT_MAIL_USER` and `CAREERPILOT_MAIL_PASSWORD` are set in `.env`) | 8025 |
| `mock-portals`, `mock-sources`, `mock-payments`, `mock-whatsapp` | Safe stand-ins for external systems | 9100–9400 |
| `otel-lgtm` | Grafana + Loki + Tempo + Prometheus + Pyroscope in one container | Grafana 3100 |

Rules:
- Local, dev, test, and CI environments never contact real employers, real mailboxes, real payment providers, or real WhatsApp numbers. Outbound integrations point to mocks by default (requirements: no real actions outside production).
- Claude API calls in local development use a small development budget; AI tests can run against recorded responses to avoid cost.

## 3. Common commands

| Command | Does |
|---|---|
| `make setup` | Install tools, copy `.env.example`, install dependencies, install git hooks |
| `make up` | Start everything (core + observability + mocks) |
| `make down` | Stop (local data stays; there is no seed or reset step, see [18-Seed-Data.md](18-Seed-Data.md)) |
| `make test` | All unit tests (backend, web, admin, mobile, packages) with coverage |
| `make test-mobile` | Mobile unit tests only |
| `make lint` / `make types` | Linters and type checks for Python and TypeScript |
| `make logs` / `make grafana` | Follow logs / open local Grafana |
| `make mobile` | Start Expo dev server for Android and iOS |

## 4. Mobile development locally

- Android: Android Studio emulator (several screen sizes and Android versions) or a real phone with a development build.
- iOS: iOS Simulator requires a Mac. Without a Mac, iOS builds and tests run on cloud build services (EAS) or CI macOS runners, and on real iPhones via development builds.
- The mobile app points to the local API through the machine's network address; accounts you create there (registration by email link) sign in as on the web.

## 5. Git hooks (tests must pass before commit)

Installed by `make setup` (pre-commit framework):

| Hook | Runs |
|---|---|
| pre-commit | Formatters, linters, type checks, secret scan, and unit tests for the changed packages |
| pre-push | All unit tests, OpenAPI drift check |
| CI (required checks) | All unit tests with coverage, lint, types, and security scans |

A commit is blocked if any check fails. Claude Code agents use the same commands, so they can't commit failing code either ([14-Testing-and-Quality.md](14-Testing-and-Quality.md)).

## 6. Production-like check without touching the dev stack

`docker-compose.prod.yml` (Caddy, internal databases, health checks, restart policies) can be validated and built on a development machine under a separate project name, without touching the running dev project `careerpilot`:

```bash
docker compose -p careerpilot-prodcheck --env-file prodcheck.env -f docker-compose.prod.yml config -q
docker compose -p careerpilot-prodcheck --env-file prodcheck.env -f docker-compose.prod.yml build
```

Use a throw-away env file outside the repository with `CAREERPILOT_SITE_PREFIX=http://`, `CAREERPILOT_DOMAIN=localhost` and high host ports (`CAREERPILOT_HTTP_PORT=18080`), and remove only `careerpilot-prodcheck` containers, networks, and volumes afterwards. Real deployments follow [../docs/runbooks/deploy-common.md](../docs/runbooks/deploy-common.md); a laptop is never exposed to the internet.
