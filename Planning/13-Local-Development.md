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
├── docker-compose.tools.yml   # Mock portals, mail catcher, load tests
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
├── evals/                     # AI evaluation sets
├── tests/
│   ├── e2e/                   # Cross-app end-to-end (Playwright, Maestro flows)
│   ├── load/                  # k6 scripts and scenarios
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
| `mailpit` | Catches all outgoing email | 8025 |
| `mock-portals`, `mock-sources`, `mock-payments`, `mock-whatsapp` | Safe stand-ins for external systems | 9100–9400 |
| `otel-lgtm` | Grafana + Loki + Tempo + Prometheus + Pyroscope in one container | Grafana 3100 |
| `k6` (on demand) | Load tests | — |

Rules:
- Local, dev, test, and CI environments never contact real employers, real mailboxes, real payment providers, or real WhatsApp numbers. Outbound integrations point to mocks by default (requirements: no real actions outside production).
- Claude API calls in local development use a small development budget; AI tests can run against recorded responses to avoid cost.

## 3. Common commands

| Command | Does |
|---|---|
| `make setup` | Install tools, copy `.env.example`, install dependencies, install git hooks |
| `make up` | Start everything (core + observability + mocks) |
| `make down` / `make reset` | Stop / stop and wipe local data |
| `make seed` | Load synthetic users, postings, circulars (including Bangla PDFs), and portal scenarios |
| `make test` | All unit and integration tests |
| `make test-e2e` | Web, admin, and API end-to-end tests |
| `make test-mobile` | Mobile unit tests + Maestro flows on a running emulator |
| `make test-load` | k6 load scenarios against local or staging |
| `make lint` / `make types` | Linters and type checks for Python and TypeScript |
| `make evals` | AI evaluation sets |
| `make logs` / `make grafana` | Follow logs / open local Grafana |
| `make mobile` | Start Expo dev server for Android and iOS |

## 4. Mobile development locally

- Android: Android Studio emulator (several screen sizes and Android versions) or a real phone with a development build.
- iOS: iOS Simulator requires a Mac. Without a Mac, iOS builds and tests run on cloud build services (EAS) or CI macOS runners, and on real iPhones via development builds.
- The mobile app points to the local API through the machine's network address; seeded test accounts sign in through local Keycloak.

## 5. Git hooks (tests must pass before commit)

Installed by `make setup` (pre-commit framework):

| Hook | Runs |
|---|---|
| pre-commit | Formatters, linters, type checks, secret scan, and unit tests for the changed packages |
| pre-push | Full unit + integration test suites, OpenAPI drift check |
| CI (required checks) | Everything, including E2E, contract, security scans, and evals |

A commit is blocked if any check fails. Claude Code agents use the same commands, so they can't commit failing code either ([14-Testing-and-Quality.md](14-Testing-and-Quality.md)).
