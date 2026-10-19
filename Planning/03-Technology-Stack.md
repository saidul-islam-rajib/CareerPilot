# Technology Stack

Each choice lists the reason and the main alternative considered. Exact versions are chosen in Sprint 0 (latest stable release at that time, at least two weeks old) and pinned in lock files. Changing a choice later requires an ADR in `docs/adr/`.

## 1. Summary

| Layer | Choice |
|---|---|
| Backend language | Python |
| Backend framework | FastAPI + Pydantic v2 |
| Database access | SQLAlchemy 2 (async) + Alembic migrations |
| Workflows / scheduling | Temporal (Python SDK) |
| Primary database | PostgreSQL + pgvector |
| Cache / rate limits / locks | Redis (or Valkey) |
| File storage | S3-compatible object storage (AWS S3; MinIO locally) |
| Browser automation | Playwright (Python) |
| AI | Claude API via the official `anthropic` Python SDK, model Claude Opus 5.5 |
| Embeddings | Multilingual embedding model (provider decided in Sprint 0) |
| OCR fallback | Tesseract with Bangla + English language data |
| User web app | Next.js (React, TypeScript) |
| Admin web app | Separate Next.js app (React, TypeScript) |
| Mobile app | React Native with Expo (TypeScript), Android + iOS |
| Shared front-end code | pnpm workspaces + Turborepo |
| Authentication | Keycloak (OIDC), separate realms for users and admins |
| Infrastructure | AWS, managed with Terraform; Docker everywhere |
| CI/CD | GitHub Actions; Expo EAS for mobile builds and store submission |
| Observability | OpenTelemetry, Sentry, Grafana (or CloudWatch) |
| Event bus | Transactional outbox → Amazon EventBridge + SQS (CloudEvents format); Kafka later if needed |
| Rules | CEL (Common Expression Language) for user and platform rules |
| Feature flags | OpenFeature API (provider chosen in Sprint 0) |
| Authorization | Policy engine (Cedar or OPA, chosen in Sprint 0) + PostgreSQL row-level security |
| File safety | ClamAV antivirus scanning for uploads |
| Module boundaries | import-linter contracts in CI |

## 2. Backend

| Need | Choice | Why | Alternative |
|---|---|---|---|
| Language | **Python** | Best ecosystem for AI, OCR, document processing, scraping, and browser automation, which are the hardest parts of this product. Claude Code is strong in Python. | TypeScript (NestJS): one language everywhere, but weaker for OCR and document tooling |
| API framework | **FastAPI** | Async, fast, generates OpenAPI automatically, Pydantic validation | Django REST Framework: heavier, sync-first |
| Validation / schemas | **Pydantic v2** | Shared models for API, AI structured outputs, and validation | — |
| ORM / migrations | **SQLAlchemy 2 + Alembic** | Mature, async support, explicit migrations | SQLModel (thinner layer on the same base) |
| Package manager | **uv** (workspace) | Fast, reproducible lock files | Poetry |
| Workflows | **Temporal** | Durable multi-day workflows, human approval signals, timers (12:00 a.m. windows, pauses), retries, exactly-once style patterns for external actions | Celery + Redis: simpler, but no durable waiting and weak guarantees for "never submit twice" |
| HTTP client | **httpx** | Async, HTTP/2, timeouts | aiohttp |
| HTML parsing | **selectolax / BeautifulSoup** | Fast parsing for connectors | — |
| Browser automation | **Playwright** | Reliable automation of modern forms, file uploads, screenshots for evidence | Selenium: slower, flakier |
| Document tools | **pypdf, Pillow, LibreOffice (headless)** | PDF merge/compress, photo and signature resizing, DOCX → PDF | — |
| OCR fallback | **Tesseract (ben + eng)** | Free fallback when Claude's document reading is unavailable or for cheap pre-checks | Cloud OCR services |

## 3. Front ends

### 3.1 Shared

| Need | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) |
| API client | Generated from the backend OpenAPI (for example with `openapi-typescript` + a typed fetch client) |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| Internationalization | English and Bangla string catalogs shared by web and mobile |
| Dates and time zones | date-fns + date-fns-tz (or Temporal API polyfill) |

### 3.2 User web app and admin app

| Need | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | Server rendering, routing, mature ecosystem |
| Styling | **Tailwind CSS** | Fast, consistent, shares tokens with mobile (NativeWind) |
| Components | **shadcn/ui (Radix based)** | Accessible primitives, owned in the repo |
| Tables (admin) | **TanStack Table** | Large filterable, sortable tables |
| Charts (admin) | **Recharts** or similar | Dashboard figures |
| i18n | **next-intl** | English/Bangla, locale routing |

The admin app is a separate Next.js app with its own domain and deployment (requirements Section 53.1).

### 3.3 Mobile app

| Need | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo** | One TypeScript codebase for Android and iOS, shares API client, validation, and strings with web |
| Navigation | **Expo Router** | File-based routing, deep links from notifications |
| Styling | **NativeWind** | Tailwind classes on mobile, same design tokens |
| Push | **expo-notifications** (Expo Push → FCM/APNs) | Approve/answer actions from notifications |
| Offline | **expo-sqlite** + TanStack Query persistence | Offline viewing of records (requirements Section 53.7) |
| Secure storage | **expo-secure-store** | Tokens on device |
| Biometrics | **expo-local-authentication** | Fingerprint/face sign-in |
| Files and camera | **expo-document-picker, expo-image-picker** | Upload documents, photos, signatures |
| Builds / store release | **EAS Build, EAS Submit, EAS Update** | Cloud builds, store submission, over-the-air fixes |
| E2E tests | **Maestro** | Simple, reliable mobile flows |

Alternative considered: Flutter. Rejected because it cannot share code with the TypeScript web apps.

## 4. Integrations

| Integration | Choice |
|---|---|
| User mailbox (send applications, read replies) | Gmail API and Microsoft Graph, OAuth with minimum scopes |
| Calendar | Google Calendar API, Microsoft Graph, plus an ICS feed |
| WhatsApp | WhatsApp Business Cloud API (Meta), approved message templates |
| Push | Expo Push Service |
| System email (digests, reports, account emails) | Amazon SES |
| Authentication | Keycloak (self-hosted): OIDC + PKCE for web and mobile, TOTP/WebAuthn MFA, `users` and `admins` realms |
| Payments | Not automated in version 1 for SMS-based fees; tracked only. Card/online payments only through official portal flows under payment rules |

## 5. Infrastructure and operations

| Need | Choice |
|---|---|
| Cloud | AWS (region decided in Sprint 0; Mumbai `ap-south-1` or Singapore `ap-southeast-1` for low latency to Bangladesh) |
| Compute | ECS Fargate for APIs, web apps, and workers; separate task pool for browser automation |
| Database | Amazon RDS for PostgreSQL (Multi-AZ in production) |
| Cache | ElastiCache (Redis/Valkey) |
| Storage | S3 with versioning; Object Lock for evidence and archived circulars |
| Secrets and keys | AWS KMS (envelope encryption) + Secrets Manager |
| Temporal | Temporal Cloud or self-hosted on ECS (decided in Sprint 0) |
| Edge | CloudFront + AWS WAF |
| Infrastructure as code | Terraform |
| Local development | Docker Compose: Postgres, Redis, MinIO, Temporal, Keycloak, Mailpit |
| CI/CD | GitHub Actions; EAS for mobile |
| Errors | Sentry (backend, web, admin, mobile) |
| Metrics, logs, traces | OpenTelemetry → Grafana Cloud or CloudWatch |
| Product analytics | PostHog (only with user consent) |

## 6. Quality and security tooling

| Area | Tools |
|---|---|
| Python | ruff (lint + format), mypy or pyright, pytest, pytest-asyncio, testcontainers |
| TypeScript | ESLint, Prettier, `tsc --noEmit`, Vitest, React Testing Library |
| Web E2E | Playwright Test |
| Mobile E2E | Maestro |
| API contract | Schemathesis against the OpenAPI spec; CI fails if generated clients are out of date |
| Accessibility | axe-core in web tests; manual screen-reader checks |
| Security | gitleaks (secrets), CodeQL, Dependabot/Renovate, Trivy (container images), OWASP ZAP (staging) |
| AI quality | Evaluation suites per AI task ([05-AI-Design.md](05-AI-Design.md)) |
