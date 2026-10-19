# Engineering Standards

Repository layout, branching, commits, CI/CD, testing, and coding rules.

## 1. Repository layout (monorepo)

The complete solution layout (including `.claude/agents`, `mocks/`, `tests/load`, `observability/`, Docker Compose files, and the Makefile) is in [13-Local-Development.md](13-Local-Development.md); the tree below shows the application code.

```text
CareerPilot/
├── CLAUDE.md                     # Instructions for Claude Code (whole repo)
├── Requirement Analysis/         # Requirements (source of truth)
├── Planning/                     # This planning set
├── docs/
│   ├── adr/                      # Architecture decision records
│   ├── api/                      # Generated OpenAPI spec
│   └── runbooks/                 # Operations and incident runbooks
├── apps/
│   ├── web/                      # User web app (Next.js)
│   ├── admin/                    # Admin web app (Next.js)
│   └── mobile/                   # User mobile app (Expo, Android + iOS)
├── packages/                     # Shared TypeScript packages
│   ├── api-client/               # Generated from OpenAPI
│   ├── ui-tokens/                # Design tokens (web + mobile)
│   ├── ui-web/                   # Shared web components (web + admin)
│   ├── i18n/                     # String catalogs (English in v1)
│   ├── validation/               # Zod schemas shared by web and mobile
│   └── config/                   # ESLint, TypeScript, Prettier presets
├── services/                     # Python (uv workspace)
│   ├── core/                     # Domain modules (bounded contexts), platform, AI
│   ├── plugins/                  # Sources, routes, channels, transformers, country packs
│   ├── api/                      # User API and admin API entry points
│   └── workers/                  # Temporal workflows and activities (one entry per task queue)
├── infra/
│   ├── terraform/                # AWS infrastructure
│   └── docker/                   # Dockerfiles, docker-compose for local
└── .github/workflows/            # CI/CD
```

## 2. Branching and commits

- **Trunk-based development.** `main` is always releasable. Work happens on short-lived branches (`feat/...`, `fix/...`, `chore/...`) merged by pull request within a few days.
- **All tests pass before every commit.** Git hooks run formatters, linters, type checks, secret scan, and tests for changed packages on commit, and the full unit + integration suites on push ([13-Local-Development.md](13-Local-Development.md) §5). Never skip or disable tests to commit.
- **Small commits, short messages.** One logical portion per commit, imperative and brief, for example `Add excluded countries rule`. A pull request may contain several small commits; merge with rebase or a merge commit so they are kept.
- **Pull requests** link the story and requirement IDs, describe how it was tested, and include screenshots for UI changes on web and mobile.
- **Reviews.** At least one human approval. Changes to authentication, credentials, automation safety, payments, AI prompts, or database migrations need a second reviewer.
- **Protected `main`.** CI must pass; no direct pushes.

## 3. CI/CD

| Pipeline | Runs on | Steps |
|---|---|---|
| Backend | PR + main | ruff, type check, import-linter (module boundaries), unit tests with coverage, OpenAPI generation and drift check, Docker build, Trivy scan |
| Web / admin | PR + main | lint (including accessibility lint rules), type check, Vitest unit tests with coverage, build |
| Mobile | PR + main | lint, type check, Jest unit tests with coverage; EAS build on main |
| Security | PR + nightly | gitleaks, CodeQL, dependency updates, container scans |
| Deploy | main → dev (automatic); tag → staging; approved release → production | Terraform plan/apply, database migrations, rolling deploys |
| Mobile release | Release tag | EAS Submit to Google Play and App Store; EAS Update for JS-only fixes |

## 4. Testing strategy

| Level | What | Tools | Target |
|---|---|---|---|
| Naming | TypeScript tests `*.spec.ts(x)` next to code; Python `test_*.py`; see [17-Project-Structure.md](17-Project-Structure.md) §4 | — | — |
| Unit (the only test type in v1) | Domain rules, handlers, workflows, plugins, AI code (recorded responses), UI components and hooks | pytest, Vitest, Jest | ≥ 95% domain, ≥ 85% backend, ≥ 80% front end ([14-Testing-and-Quality.md](14-Testing-and-Quality.md)) |

Rules:
- Tests never submit to real employers or send real emails. Outbound actions use mock portals and sandbox mailboxes (see [02-Architecture.md](02-Architecture.md) §7).
- Every corner case listed in requirements Sections 30, 31, 42, and 25.1 gets an automated test.
- Time-dependent logic is tested with a controllable clock (midnight windows, daylight-saving changes, birthdays, expiries).

## 5. Coding rules

- **API.** Versioned paths (`/v1/...`), OpenAPI-first, consistent error format, pagination on all lists, idempotency keys on all endpoints that start external actions.
- **Domain rules in one place.** Status model, precedence, pause, archive, compensation, and admin access each live in one module (requirements Section 45). Never re-implement them in front ends; front ends display what the API returns.
- **Time.** Store UTC plus original time zone; use the user's time zone only for display.
- **Money.** Integer minor units plus currency code; never floats.
- **Text.** No hard-coded user-facing strings; everything goes through string catalogs (English in v1).
- **Logging.** Structured logs; personal data and secrets are scrubbed; every log line carries a request or workflow ID.
- **Feature flags.** New risky features (new routes, automatic mode per route) ship behind flags controlled from the admin app.
- **Dependencies.** Pinned and updated weekly by Renovate/Dependabot; new dependencies need a reason in the PR.
- **ADRs.** Any change to the stack, architecture, or a cross-cutting rule needs a short ADR in `docs/adr/`.
