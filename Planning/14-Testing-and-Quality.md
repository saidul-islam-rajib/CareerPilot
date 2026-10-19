# Testing and Quality Plan

This expands the testing section of [07-Engineering-Standards.md](07-Engineering-Standards.md). Rule: **no commit and no release with a failing test.**

## 1. Test types

| Type | Scope | Tools | When |
|---|---|---|---|
| Unit | Domain rules, helpers, components | pytest, Vitest, Jest (mobile) | Pre-commit (changed packages), CI |
| Integration | API + DB + Redis + S3 + Temporal + mocks | pytest + testcontainers | Pre-push, CI |
| Contract | API vs OpenAPI; events vs schemas; plugins vs interfaces | Schemathesis, JSON Schema checks | CI |
| End-to-end (web, admin) | Full user and admin journeys | Playwright Test | CI on every PR (critical set), nightly (full) |
| End-to-end (mobile) | Android and iOS journeys | Maestro on emulators/simulators | CI nightly, before every release |
| UI validation | Visual regression, layout on many screen sizes, accessibility, form validation messages | Playwright screenshots, axe-core, Maestro screenshots | Every PR touching UI |
| AI evaluation | Each AI task | `evals/` runners | When prompts, models, or AI code change |
| Load and performance | See §4 | k6, Pyroscope | Nightly on staging; before every release |
| Security | SAST, dependencies, secrets, containers, DAST | CodeQL, Dependabot, gitleaks, Trivy, OWASP ZAP | Every PR; DAST weekly |
| Resilience (chaos) | Kill containers, slow database, provider outages, network errors | Toxiproxy, scripted failures | Weekly on staging |
| Data quality | Extraction accuracy, dedup correctness, reconciliation | Fixture datasets, reconciliation job | Nightly |
| Mutation testing | Strength of tests for critical domain rules (status model, precedence, compensation, countries, computed answers) | mutmut | Weekly |

Coverage targets: domain modules ≥ 90% lines and branches; overall backend ≥ 80%; front-end features ≥ 70% plus E2E for every acceptance criterion.

## 2. Registration, sign-in, and account test suite (must always pass)

| Area | Cases |
|---|---|
| Registration | Email and phone sign-up; duplicate email/phone; weak/breached password rejected; verification email/OTP success, expiry, resend limits; terms and privacy consent recorded; minimum age rule |
| Sign-in | Correct/incorrect password; locked account after repeated failures; rate limiting; passkey sign-in; social sign-in (if enabled) |
| MFA | Enrol TOTP/passkey; sign-in with MFA; lost device recovery codes; admin MFA mandatory |
| Sessions | Token refresh; expiry; sign out; sign out everywhere; multiple devices (web + Android + iOS at once); re-authentication for sensitive actions |
| Password reset | Request, link expiry, single use, all sessions revoked after reset |
| Mobile | PKCE flow; biometric unlock; secure storage; app reinstall; offline start shows cached data and asks to sign in when needed |
| Web BFF | httpOnly cookie; CSRF protection; no tokens in browser storage |
| Admin | Separate realm; user accounts can't reach the admin app; role permissions enforced |
| Account lifecycle | Suspend/reactivate; deletion request, cancellation in grace period, final deletion, data really gone |
| Security | Brute force, credential stuffing simulation, session fixation, open redirect, IDOR on profile endpoints |

## 3. Device and browser matrix

| Platform | Coverage |
|---|---|
| Android | Oldest supported Android version through the latest; small (5"), regular, large phones, and a tablet; emulators in CI + periodic checks on real low-end devices |
| iOS | Oldest supported iOS version through the latest; iPhone SE size through Pro Max; iPad; simulators (macOS runners) |
| Web | Latest Chrome, Edge, Firefox, Safari; mobile Chrome and Safari; widths 360 px to 1920 px |
| Admin | Latest Chrome and Edge on desktop |

Minimum OS versions follow the Expo SDK chosen in Sprint 0 (requirements decision 59), aiming to support as many phones as that SDK allows.

## 4. Load and performance testing

| Scenario | What it simulates | Initial target (to confirm) |
|---|---|---|
| **Baseline** | Normal daily usage | p95 read API < 300 ms, error rate < 0.1% |
| **Peak** | 3× normal: morning digest opens + approvals | p95 < 500 ms, no errors from capacity |
| **Midnight burst** | Many scheduled submissions at 12:00 a.m. (requirements §49) | 99% of submissions start within 10 min of the window; no duplicate submissions |
| **Digest burst** | Digests for all users in a popular time zone at the same minute | 99% delivered within 15 min |
| **Stress** | Increase load until failure | Graceful degradation; queues absorb load; no data loss; recovery without manual steps |
| **Spike** | Sudden 10× traffic | Autoscaling or queueing keeps errors < 1%; recovery within 10 min |
| **Soak** | Normal load for 8–24 hours | No memory leaks; stable latency; no growing queues |
| **Discovery throughput** | Many sources and new postings | Daily cycle finishes within its window; AI batch within budget |
| **Database** | Large tables (millions of records, partitions) | Key queries within budget; index plans checked |
| **Scalability** | Add worker/API instances | Throughput grows roughly linearly |

- k6 scripts in `tests/load/`, run nightly on staging with results in Grafana; the Performance Analyst agent compares each run with the previous one and flags regressions over 10%.
- Pyroscope profiles during load tests show hot spots.
- Mobile performance: app start time, screen render time, memory use, and bundle size tracked per release.

## 5. UI validation rules

The UI Validation agent checks every screen against [16-UX-Design.md](16-UX-Design.md):

- Every form field has a label, help text where needed, and clear inline validation messages (what is wrong and how to fix it).
- Validation happens on the client for speed and on the server for truth; server errors map to the right field.
- No layout breaks from 320 px phone width to large desktop; touch targets at least 44 × 44 pt (iOS) / 48 × 48 dp (Android).
- Accessibility: WCAG 2.2 AA (contrast, focus order, screen-reader names, no colour-only meaning).
- Loading, empty, error, and offline states exist for every screen.
- Visual regression diffs are reviewed and approved.

## 6. Quality gates

| Gate | Must pass |
|---|---|
| Commit | Format, lint, types, secret scan, unit tests of changed packages |
| Push | All unit + integration tests, OpenAPI drift |
| Pull request merge | All CI checks, E2E critical set, UI validation, security scans, reviewer agents (and human approval for sensitive areas) |
| Staging release | Full E2E (web, admin, mobile), load tests, DAST, evals, migration dry run |
| Production release | All staging gates green, rollback plan, Product Owner approval |
| Play Store release | Release checklist in [15-Mobile-and-Play-Store.md](15-Mobile-and-Play-Store.md) |
