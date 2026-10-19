# CareerPilot

Job discovery and application assistant for job seekers and students (Bangladesh and international). Version 1 is built with AIDLC (AI-Driven Development Lifecycle): AI agents do the work, the Product Owner validates at checkpoints (`Planning/10-AIDLC-Agents.md`).

## Read first

- Requirements (source of truth): `Requirement Analysis/Requirements.md`
- Plans: `Planning/` (start with `Planning/README.md`)
- Architecture and design: `Planning/Design/` (module boundaries, plugin interfaces, state machines, API and event conventions)

## Parts of the product

- `services/` — Python backend: FastAPI (user API + admin API), Temporal workers, AI (Claude), adapters
- `apps/web` — user web app (Next.js)
- `apps/admin` — admin web app (Next.js, separate deployment)
- `apps/mobile` — user mobile app (Expo, Android + iOS)
- `packages/` — shared TypeScript packages (generated API client, UI tokens, i18n, validation)

(Folder skeleton exists with READMEs; code is added from Sprint 0. Canonical structure: `Planning/17-Project-Structure.md`.)

## Agent access (standing authorization)

- Claude and all AIDLC agents have full access to every file in this project directory and may read, create, update, move, and delete files **without asking the user**. Permissions are pre-configured in `.claude/settings.json`.
- This covers the project directory only; force-push, real external actions, and sensitive production releases still follow the checkpoints in `Planning/10-AIDLC-Agents.md` §4.

## How to build

- Follow the folder structure in `Planning/17-Project-Structure.md`; write a spec in `specs/<epic>-<feature>/` before coding a feature.
- Tests: TypeScript `*.spec.ts(x)` next to code, Python `test_*.py`; E2E in `tests/e2e/`.
- Every new table ships with seed data (`Planning/18-Seed-Data.md`); local default admin is `admin@sober.com` / `admin@sober.com`.
- Use Redis only as described in `Planning/Design/16-Redis-and-Caching.md` (never as source of truth).
- All screens are designed by the UX/UI agent to `Planning/16-UX-Design.md`, responsive from small phones to desktop, with drag and drop where order matters.

## Non-negotiable rules

- If code and requirements disagree, stop and ask. Don't silently choose.
- Use the single definitions in the requirements: status model (§20.2), precedence (§38), user-only steps (§27.3), pre-submission checks (§27.4), pause (§47), submission timing (§49), circular archive (§50), compensation (§51), admin access (§53).
- Never fabricate user facts, never solve CAPTCHAs or evade bot detection, never resubmit when the outcome is unknown, never log or return secrets or plain-text credentials.
- Never send real applications, emails, or payments from local, dev, test, staging, or CI.
- v1 UI is English only and light theme only; all user-facing text still goes through string catalogs and colours through design tokens (so Bangla and dark mode can be added later).
- All tests must pass before every commit (git hooks + CI); never skip or disable tests to commit.
- Commit portion by portion with very short messages.
- Keep costs low: prefer free tiers and self-hosted open-source tools (`Planning/12-Cost-Plan.md`).
- Every service emits OpenTelemetry logs, traces, and metrics for Grafana (`Planning/11-Observability.md`).
- Requirements stay at version 1.0; edit in place, don't add revision rows.
