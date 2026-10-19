# Testing and Quality Plan

**Version 1 uses automated unit tests only** (requirements §25.1). Integration, end-to-end, contract, load, visual-regression, and other automated test types are out of scope for version 1 and can be added later without changing the code structure. Rule: **no commit and no release with a failing unit test.**

## 1. What unit tests cover

| Area | Examples |
|---|---|
| Domain rules (backend) | Status model transitions (§20.2), precedence (§38), pre-submission checks (§27.4), pause (§47), submission windows (§49), compensation rules (§51), excluded countries (§5.3), computed answers (§39), deadlines and time zones, duplicate detection logic |
| Application services (backend) | Command and query handlers with fake repositories, fake gateways, fake clock |
| Workflows (backend) | Temporal workflow and activity logic with Temporal's test environment and fakes (no real services) |
| Plugins (backend) | Source connectors, route adapters, channels, payment providers against recorded responses and fakes |
| AI code (backend) | Prompt building, schema validation, claim checks, refusal handling, cost tracking — using recorded Claude responses (no live AI calls in tests) |
| Redis usage | Cache, rate-limit, lock, and session logic with an in-memory fake |
| Security rules | Authorization decisions, owner/tenant checks, log scrubbing, secret masking, webhook signature verification |
| Web and admin | Components, hooks, form validation, status display, drag-and-drop ordering logic, media viewer logic (zoom/pan state) |
| Mobile | Components, hooks, offline outbox logic, secure-storage wrapper, notification action handling |
| Shared packages | Formatting, dynamic forms, validation schemas, API client wrappers |

## 2. Registration, sign-in, and account unit tests (must always pass)

| Area | Cases |
|---|---|
| Registration | Required consent checkbox; consent record (versions, time, IP, device); duplicate email/phone; password policy; verification code expiry and resend limits; minimum age rule |
| Sign-in | Correct/incorrect credentials; lockout after repeated failures; rate limiting; sign-in history record (IP, device, approximate location, result); new-sign-in alert |
| MFA and sessions | Enrolment, verification, recovery codes; token refresh and expiry; sign out everywhere; re-authentication for sensitive actions |
| Password reset | Link expiry, single use, sessions revoked after reset |
| Mobile and web auth logic | Token storage wrappers, biometric unlock flow logic, BFF cookie/session handling |
| Admin | Realm separation, role permissions |
| Account lifecycle | Suspend/reactivate, deletion request, cancellation in grace period, anonymization logic, soft delete and restore, audit columns set automatically |

## 3. Tools and conventions

| Code | Framework | Naming and place |
|---|---|---|
| Python | pytest (+ pytest-asyncio, freezegun/fake clock, Temporal test environment) | `services/*/tests/unit/**/test_*.py`, mirroring source folders |
| TypeScript (web, admin, packages) | Vitest + Testing Library | `*.spec.ts` / `*.spec.tsx` next to the code |
| Mobile | Jest (jest-expo) + React Native Testing Library | `*.spec.ts` / `*.spec.tsx` next to the code |

Rules:
- Unit tests never touch real databases, networks, AI providers, mailboxes, portals, or payment providers; they use fakes, mocks, and recorded responses.
- Every corner case listed in requirements §30, §31, §42, and §25.1 has a unit test.
- Time-dependent logic uses a controllable clock (midnight windows, daylight-saving changes, birthdays, expiries).
- Every bug fix (including automatic fixes, §24.3) starts with a failing unit test that reproduces it.

## 4. Coverage targets

| Scope | Target |
|---|---|
| Domain modules (status model, precedence, rules, checks) | ≥ 95% lines and branches |
| Backend overall | ≥ 85% |
| Front-end features and shared packages | ≥ 80% |

Coverage is reported on every pull request; a drop below target blocks the merge.

## 5. Checks that are not tests

These run alongside unit tests and also block commits or merges when they fail: formatting, linting, type checking, module-boundary checks (import-linter), secret scanning, dependency and code scanning, OpenAPI and client freshness checks.

## 6. Quality gates

| Gate | Must pass |
|---|---|
| Commit (git hook) | Format, lint, types, secret scan, unit tests of changed packages |
| Push (git hook) | All unit tests, OpenAPI freshness |
| Pull request merge | All unit tests with coverage targets, static checks, reviewer agents (and human approval for sensitive areas) |
| Release | All of the above on the release build; release checklist; Product Owner approval |
| Play Store release | Checklist in [15-Mobile-and-Play-Store.md](15-Mobile-and-Play-Store.md), with a manual check of the build on an Android device |
