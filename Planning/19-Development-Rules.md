# Development Rules

Mandatory rules for every line of code in CareerPilot (backend, AI, web, admin, mobile, infrastructure). Agents and people follow them without exception; the Code Reviewer agent rejects any change that breaks one. Where a rule needs a tool to enforce it, the tool is listed. Related: [07-Engineering-Standards.md](07-Engineering-Standards.md), [Design/01-Principles-and-Quality-Attributes.md](Design/01-Principles-and-Quality-Attributes.md), [Design/06-Data-Model.md](Design/06-Data-Model.md).

## 1. SOLID, enforced

| Principle | Rule in this project | Enforcement |
|---|---|---|
| Single responsibility | One reason to change per class/module. Functions ≤ 40 lines, classes ≤ 300 lines, cyclomatic complexity ≤ 10, ≤ 5 parameters (use a parameter object beyond that) | ruff (`C901`, `PLR0913`, `PLR0915`), ESLint `complexity`, `max-lines-per-function` |
| Open/closed | New behaviour is added by new classes registered in a registry (sources, routes, channels, payment providers, checks, transformers, country packs, opportunity types), never by editing a `switch`/`if` chain on a type | Code review; `match`/`switch` on a type discriminator is only allowed inside a registry or factory |
| Liskov substitution | Every implementation of a port honours the port's contract; one shared contract test suite runs against every implementation (unit level, with fakes) | `tests/unit/contracts/` per port |
| Interface segregation | Small, role-specific ports (`ApplicationReader`, `ApplicationWriter`), not one large service interface | Code review |
| Dependency inversion | Domain and application layers depend only on ports (Python `Protocol`, TypeScript interfaces). Adapters are wired in one composition root per process through dependency injection; no module creates its own infrastructure clients | import-linter contracts (backend), ESLint `boundaries` (front end) |

## 2. Design patterns (where each one is used)

Use the pattern listed for the problem; don't invent a new style for a solved problem.

| Problem | Pattern | Where |
|---|---|---|
| Isolate business logic from infrastructure | Hexagonal (ports and adapters), layered `domain → application → ports → adapters` | Every bounded context ([17-Project-Structure.md](17-Project-Structure.md) §2.1) |
| Data access | Repository + Unit of Work (one transaction per command) | All persistence |
| Interchangeable providers | Strategy, selected by a Registry/Factory from configuration | Sources, application routes, channels, AI models, payment providers, storage |
| Wrapping external APIs | Adapter + Anti-corruption layer (external models never leak into the domain) | Portals, email, WhatsApp, payments, Claude |
| Cross-cutting behaviour (cache, retry, metrics, tracing, authorization) | Decorator on ports or handlers | Platform module |
| Pre-submission checks, validation steps, enrichment | Chain of Responsibility / Pipeline, each step a class | Requirements §27.4 checks, discovery pipeline |
| Eligibility, filters, rules | Specification (composable `and`/`or`/`not`) | Matching, automation rules, compensation (§51), excluded countries |
| Lifecycles | State pattern from a declarative transition table | Application, approval, account, payment (Design/07) |
| Commands and queries | Command/Query handlers (CQRS-lite) with one handler per use case | Application layer |
| Reacting to changes | Domain events + transactional Outbox (Observer, decoupled) | Design/10 |
| Long multi-step processes | Saga / process manager (Temporal workflows) with compensating steps | Submission, account deletion, payments |
| Building complex objects | Builder | Application packages, prompts, emails |
| Resilience | Retry with backoff and jitter, Timeout, Circuit breaker, Bulkhead, Idempotency key | Every outbound call |
| Front end | Feature slices, container/presentational split, custom hooks, compound components, adapter over the generated API client | apps/web, apps/admin, apps/mobile |

Banned: god classes, service locator, mutable global state and singletons outside the composition root, inheritance deeper than two levels (prefer composition), business logic in controllers, routes, UI components, or database triggers.

## 3. Nothing hard-coded: configuration first

No business value is ever written as a literal in code. Every default comes from configuration.

**Configuration layers** (later overrides earlier; all typed and validated at startup, the service refuses to start on invalid config):

1. `config/defaults/*.yaml`: every default value in the system, with a JSON Schema, a description, unit, and allowed range for each key.
2. `config/env/<local|dev|staging|prod>.yaml`: per-environment overrides.
3. Environment variables and AWS Secrets Manager / SSM (secrets only ever come from here).
4. Runtime settings in the `platform_settings` table, editable in the admin app, scoped global → tenant → user, cached in Redis and invalidated by event (Design/16).
5. Feature flags (OpenFeature) for on/off and gradual rollout.

Backend reads configuration only through typed settings classes (pydantic-settings) injected as dependencies; front ends read build-time public config through a Zod-validated module and runtime settings through `GET /v1/config`.

| Kind of value | Where it lives |
|---|---|
| Limits, thresholds, counts, caps, timeouts, retries, intervals, page sizes, file size/type limits, cache TTLs, schedules | `config/defaults` (+ runtime settings when admins may change them) |
| URLs, hosts, ports, bucket and queue names | Environment config |
| Secrets, keys, credentials | Secrets Manager / `.env` locally; never in code or config files |
| User-facing text and error messages | String catalogs (`packages/i18n`, backend message catalogs), referenced by key |
| Colours, spacing, fonts, radii | Design tokens (`packages/ui-tokens`) |
| Status and type values | Enums (§4) |
| Roles and permissions | Policy files (Cedar/OPA) |
| AI model names, prompts, and parameters | Prompt registry files (versioned) + config |
| Country, currency, grading scales, holidays | Reference data in `config/` |

Allowed literals: `0`, `1`, `-1`, empty string/collection, and boolean values in obvious arithmetic or logic; values inside enum definitions, config files, migrations, and tests. Enforced by ruff `PLR2004` (magic values), ESLint `no-magic-numbers`, `i18next/no-literal-string` (no raw text in JSX), a Tailwind/NativeWind rule that allows only token classes, and gitleaks for secrets.

## 4. Statuses and types: always enums, dynamic display

- Every status, type, category, role, channel, and kind is an enum: Python `StrEnum` in the context's `domain/enums.py` (single source of truth), exported through OpenAPI and generated into TypeScript union types in `packages/api-client`. No raw status strings anywhere else.
- Database columns store the enum value as `text` with a `CHECK` constraint generated by the migration from the enum (easier to extend than PostgreSQL enum types).
- Display is dynamic: the `enum_values` reference table holds, per enum value, the label key, description key, colour token, icon, sort order, `is_terminal`, and `is_active`. Admins can change labels, order, colour, and activation in the admin app; front ends render from it and never map values to labels themselves.
- Adding a new value is a code change (enum + migration + `config/defaults/enum-values.yaml` entry + string catalog entry), so business logic can never meet an unknown value. Transitions between statuses come from the declarative transition table of the state machine, never from scattered `if` statements.

## 5. Every table: audit columns and no physical delete

Every table, without exception, has these columns, set automatically by the persistence layer (a SQLAlchemy base mixin and session events fed by the request/workflow context), never by handlers. A database trigger also sets `updated_at` as a safety net.

| Column | Meaning |
|---|---|
| `id` | UUIDv7 |
| `tenant_id` | Tenant (single tenant in v1) |
| `created_at`, `created_by`, `created_by_type` | When and by whom (`user` / `admin` / `system` / `agent`) the row was created |
| `updated_at`, `updated_by`, `updated_by_type` | Last change; equal to the created values on insert |
| `deleted_at`, `deleted_by`, `deleted_by_type`, `delete_reason` | Logical deletion; null when active |
| `version` | Optimistic locking (API ETag / `If-Match`) |

Deletion rules:

- **No physical deletes.** The application database roles have no `DELETE` (or `TRUNCATE`) privilege; repositories expose `soft_delete()` and `restore()` only. Code must not contain `DELETE` statements or ORM delete calls (lint rule + review).
- Default query scopes exclude deleted rows; unique indexes are partial (`WHERE deleted_at IS NULL`); admin views can include deleted rows.
- Deleting a parent soft-deletes its owned children in the same transaction (cascade in the domain service, not the database).
- **Permanent deletion** (user's choice, end of the recently-deleted period, or account deletion, requirements §46) is **irreversible anonymization**: personal fields are overwritten with nulls or anonymous tokens, the user's file encryption key is destroyed (crypto-shredding) so stored files and archived copies become unreadable, and the row stays as an anonymized, deleted record. This meets the right to erasure without physical deletion. Object storage bytes of shredded files are later removed by the storage lifecycle policy (housekeeping, not an application delete).
- Insert-only tables (events, evidence, audit) also reject `UPDATE` through a trigger, except the anonymization job's controlled redaction.

## 6. Reusable, dynamic, scalable methods

- **Generic building blocks first.** Use the shared generics before writing new code: `BaseRepository[T]` (CRUD, soft delete, restore, cursor pagination, filtering, sorting), `CrudService[T]` with policy hooks, generic admin resource registration (every table gets list/view/create/update/delete/restore in the admin app from its metadata), shared React hooks and components, `dynamic-forms` from JSON Schema.
- **Data-driven, not code-driven.** Opportunity types, form fields, rules, filters, notification templates, and admin screens are described by metadata and schemas wherever the requirements allow change without a release.
- **Pure domain.** Domain code has no I/O. Time comes from a `Clock` port, IDs from an `IdGenerator` port, randomness from a `Random` port, so all behaviour is deterministic in unit tests.
- **Stateless and horizontally scalable.** No in-process state between requests; sessions, locks, and rate limits live in Redis; long work goes to Temporal or queues; every consumer is idempotent.
- **Efficient by default.** Async I/O for network calls; cursor pagination on every list (max page size from config); batch reads to avoid N+1; select only the needed columns; every foreign key and filter column indexed; caching only per Design/16.
- **Strict types.** Python: pyright/mypy strict, Pydantic models at every boundary. TypeScript: `strict`, no `any`, no non-null assertions.
- **Errors.** Typed domain errors with stable error codes from a catalog; API errors as RFC 9457 problem details; never swallow exceptions; every outbound call has a timeout from config.

- **No comments in code.** Code explains itself through clear names, small functions, types, and tests. No inline, block, or doc comments in source files; the only exceptions are lines a tool requires (for example `# type: ignore[code]`, `// @ts-expect-error`, shebangs, license headers of copied third-party files). Explanations belong in specs, ADRs, and READMEs.

## 7. Secure by default (OWASP ASVS level 2)

- **Validate at every boundary**: Pydantic/Zod strict models, unknown fields rejected, lengths and ranges from config.
- **Deny by default**: every handler declares its permission and the policy engine checks it; row-level security backs it in the database; admin actions are audited.
- **Injection-safe**: parameterized queries only (no string-built SQL), output encoding, no `eval`/dynamic imports from input, safe YAML/JSON loading.
- **Secrets**: never in code, logs, errors, URLs, or front-end bundles; envelope encryption with KMS; field-level encryption for sensitive personal data.
- **Web**: BFF with httpOnly, Secure, SameSite cookies; CSRF protection; strict Content-Security-Policy and security headers; CORS allow-list from config.
- **Outbound fetching**: SSRF guard (allow-listed schemes, private and metadata IP ranges blocked, egress proxy) for circulars and portals.
- **Files**: type sniffing, size limits from config, malware scan, images re-encoded, served through signed short-lived URLs.
- **Abuse**: rate limits and lockouts from config; idempotency keys on every action-starting endpoint.
- **Supply chain**: pinned dependencies, lock files committed, Dependabot, gitleaks, CodeQL, Trivy.
- **Privacy**: personal data scrubbed from logs and traces; data minimization; consent recorded (requirements §13).

## 8. Front-end rules (web, admin, mobile)

- No business rules in the UI; it renders what the API returns (statuses, labels, allowed actions).
- Server state through TanStack Query; forms through schema-driven forms and Zod; components from the shared UI packages; styles only through design tokens; text only through catalogs.
- Every screen handles loading, empty, error, offline, and permission-denied states, and is accessible (labels, focus order, contrast).

## 9. Working on this machine

- Claude never installs system-wide software or elevates privileges. When a tool is missing, it adds the tool to `docs/runbooks/machine-setup.md`, marks the dependent task `- [!]`, and keeps working on everything that doesn't need it (writing code, specs, and unit tests that run with what is installed). The user installs tools later.
- When unsure, the agent applies the recommendation in these documents and its best judgement, records the choice in the feature spec (and an ADR for cross-cutting choices), and continues; it does not wait for the user.

## 10. Definition of done (per change)

- [ ] Traces to a spec and requirement IDs; spec updated.
- [ ] Follows §1–§8: no hard-coded values, enums for statuses, audit columns and soft delete on new tables, generic building blocks reused.
- [ ] New config keys added to `config/defaults` with schema and description; no seed data; new enum values have `config/defaults/enum-values.yaml` entries and catalog entries.
- [ ] Unit tests written and passing with coverage targets met ([14-Testing-and-Quality.md](14-Testing-and-Quality.md)); lint, type checks, and secret scan clean.
- [ ] Logs, traces, and metrics emitted ([11-Observability.md](11-Observability.md)).
- [ ] Committed in a small portion with a short message.
