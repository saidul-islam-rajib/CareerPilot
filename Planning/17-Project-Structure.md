# Project Structure (Solution Skeleton)

The single, canonical folder structure for the whole solution. It follows common monorepo practice: apps, shared packages, services, infrastructure, and tests are separated; every part is discoverable by humans and agents. Other documents refer to this one.

## 1. Top level

```text
CareerPilot/
├── .claude/                     # Claude Code: settings.json (permissions), agents/, skills/, commands/
├── .devcontainer/               # Ready-made development container
├── .github/
│   ├── workflows/               # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/          # Story, bug, incident templates
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS               # Sensitive paths require Product Owner approval
│   └── dependabot.yml
├── Requirement Analysis/        # Requirements (source of truth)
├── Planning/                    # Plans; Planning/Design/ for architecture
├── specs/                       # Feature specifications (spec-driven development, §3)
├── apps/
│   ├── web/                     # User web app (Next.js)
│   ├── admin/                   # Admin web app (Next.js)
│   └── mobile/                  # User mobile app (Expo: Android + iOS)
├── packages/                    # Shared TypeScript packages
│   ├── api-client/              # Generated from OpenAPI
│   ├── ui-tokens/               # Design tokens (light theme)
│   ├── ui-web/                  # Web components (web + admin)
│   ├── ui-native/               # Mobile components
│   ├── media-viewer/            # Shared image/document viewer logic (zoom, pan, rotate)
│   ├── dynamic-forms/           # JSON Schema → form model
│   ├── domain-ui-logic/         # Status labels, formatting, dates, money
│   ├── i18n/                    # String catalogs (English in v1)
│   ├── validation/              # Zod schemas
│   └── config/                  # ESLint, TypeScript, Prettier, Vitest presets
├── services/                    # Python (uv workspace)
│   ├── core/                    # Bounded contexts + platform + AI (Design/04)
│   ├── plugins/                 # sources/, routes/, channels/, payments/, transformers/, countries/
│   ├── api/                     # user_api.py, admin_api.py entry points
│   └── workers/                 # Temporal workers per task queue
├── seeds/                       # Seed data for every table (Planning/18)
├── mocks/                       # Mock portals, sources, payments, WhatsApp, mail
├── tests/
│   └── fixtures/                # Shared synthetic files (CVs, circulars, images)
├── observability/               # Alloy config, dashboards/, alerts/, slo/
├── infra/
│   ├── terraform/               # modules/, envs/{dev,staging,prod}
│   ├── docker/                  # Dockerfiles per service
│   └── compose/                 # Server Compose files (lean stage)
├── docs/
│   ├── adr/                     # Architecture decision records
│   ├── api/                     # openapi.yaml (generated)
│   ├── events/                  # Event JSON Schemas (generated)
│   └── runbooks/                # Operations and incident runbooks
├── scripts/                     # Developer and CI helper scripts
├── docker-compose.yml           # Core local services
├── docker-compose.observability.yml
├── docker-compose.tools.yml     # Mocks, mail catcher, load tools
├── Makefile                     # One entry point for every task
├── .env.example                 # Local defaults (no real secrets)
├── .editorconfig  .gitignore  .gitattributes  .pre-commit-config.yaml
├── package.json  pnpm-workspace.yaml  turbo.json   # TypeScript workspace
├── pyproject.toml  uv.lock                          # Python workspace
├── README.md  CLAUDE.md  CONTRIBUTING.md  SECURITY.md
```

## 2. Inside each part

### 2.1 Python service context (example: `services/core/src/careerpilot/applications/`)

```text
applications/
├── domain/          # entities.py, value_objects.py, events.py, services.py, state_machine.py
├── application/     # commands.py, queries.py, handlers.py, dto.py
├── ports/           # repositories.py, gateways.py
├── adapters/        # sqlalchemy_repo.py, cache.py (Redis), outbox.py
├── api/             # user_routes.py, admin_routes.py, schemas.py
├── workflows/       # Temporal workflows and activities for this context
├── seeds/           # Seed factories for this context's tables
└── module.py        # Public interface
services/core/tests/
└── unit/applications/
    ├── test_state_machine.py
    └── test_submission_flow.py      # with fakes; unit tests only in v1
```

### 2.2 Next.js app (`apps/web/`, same for `apps/admin/`)

```text
apps/web/
├── src/
│   ├── app/                 # Routes (thin)
│   ├── features/<feature>/  # components/, hooks/, screens/, <name>.spec.tsx tests next to code
│   ├── shared/              # Layout, providers, utilities
│   └── bff/                 # Session, token exchange, API proxy
├── public/
├── next.config.ts  tailwind.config.ts  vitest.config.ts
```

### 2.3 Expo app (`apps/mobile/`)

```text
apps/mobile/
├── app/                     # Expo Router routes
├── src/features/<feature>/  # components/, hooks/, screens/, <name>.spec.tsx
├── src/shared/              # Providers, offline outbox, secure storage
├── assets/                  # Icons, splash, fonts
├── app.config.ts  eas.json
```

## 3. Specs (spec-driven development)

Every feature (story or group of stories) gets a spec folder before code is written. Agents create and update them.

```text
specs/
├── _template/
│   ├── requirements.md      # User stories, acceptance criteria (EARS style), requirement IDs
│   ├── design.md            # API, data, events, UI states, edge cases for this feature
│   ├── tasks.md             # Ordered implementation tasks (bolts) with status
│   └── test-plan.md         # Test cases mapped to acceptance criteria
└── <epic-id>-<feature>/     # e.g. E02-profile-photo-and-signature/
```

Rules:
- A feature's code, tests, and seeds must trace back to its spec; the spec references requirement IDs.
- Specs are updated in the same pull request when behaviour changes.

## 4. Test file naming

Version 1 has **unit tests only** ([14-Testing-and-Quality.md](14-Testing-and-Quality.md)). `tests/fixtures/` holds shared recorded responses and synthetic files used by unit tests.

| Kind | Location | Naming |
|---|---|---|
| TypeScript unit tests (web, admin, mobile, packages) | Next to the code | `*.spec.ts` / `*.spec.tsx` |
| Python unit | `services/*/tests/unit/` mirroring source | `test_*.py` (pytest) |

## 5. Rules

- New top-level folders need an ADR; new features go inside the existing structure.
- Every folder at the second level has a short `README.md` explaining its purpose.
- Generated files (API client, OpenAPI, event schemas) are committed and checked for freshness in CI.
- No secrets anywhere in the tree; `.env.example` holds only local defaults.
