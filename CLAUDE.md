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
- Claude may run any shell command (Bash, PowerShell, cmd) needed for this project without asking, and may use this machine for CareerPilot development only. Never touch files or settings outside the project for other purposes.
- Never install system-wide software or elevate (sudo, admin). If a tool is missing, list it in `docs/runbooks/machine-setup.md` for the user to install, mark the dependent task `- [!]`, continue with the recommended workaround or the next task, and never wait for an answer.
- **Don't stop until the job is done.** Work through the open tasks in `specs/*/tasks.md` without asking questions; make the recommended choice and record it in the spec. A Stop hook keeps the session going while tasks are open; `scripts/autopilot.ps1` resumes work after usage limits reset. Pause with `.claude/autopilot-off`.
- This covers the project directory only; force-push, real external actions, and sensitive production releases still follow the checkpoints in `Planning/10-AIDLC-Agents.md` §4 (mark those tasks `- [!]` and move on).

## How to build

- Follow the folder structure in `Planning/17-Project-Structure.md`; write a spec in `specs/<epic>-<feature>/` before coding a feature.
- Tests: **unit tests only** in v1 — TypeScript `*.spec.ts(x)` next to code, Python `test_*.py` in `services/*/tests/unit/` (`Planning/14-Testing-and-Quality.md`).
- Every new table ships with seed data (`Planning/18-Seed-Data.md`); local default admin is `admin@sober.com` / `admin@sober.com`.
- Use Redis only as described in `Planning/Design/16-Redis-and-Caching.md` (never as source of truth).
- All screens are designed by the UX/UI agent to `Planning/16-UX-Design.md`, responsive from small phones to desktop, with drag and drop where order matters.

## Non-negotiable rules

- Don't write comments in code (no inline, block, or doc comments); use clear names, small functions, and types instead. Tool-required directives are the only exception (`Planning/19-Development-Rules.md` §6).

- Follow `Planning/19-Development-Rules.md` strictly: SOLID and the listed design patterns; nothing hard-coded (every default from `config/`, text from catalogs, colours from tokens); every status/type an enum; every table has automatic `created_*`, `updated_*`, `deleted_*` audit columns; never physically delete (soft delete; permanent deletion = anonymization); reusable generic building blocks; secure by default (OWASP ASVS L2).

- If code and requirements disagree, don't silently choose: mark the task `- [!]` with both options and your recommendation, then continue with other tasks.
- Use the single definitions in the requirements: status model (§20.2), precedence (§38), user-only steps (§27.3), pre-submission checks (§27.4), pause (§47), submission timing (§49), circular archive (§50), compensation (§51), admin access (§53).
- Never fabricate user facts, never solve CAPTCHAs or evade bot detection, never resubmit when the outcome is unknown, never log or return secrets or plain-text credentials.
- Never send real applications, payments, or other email from local, dev, test, staging, or CI. The only exception is account email a person asks for themselves (registration and password-reset links, verification codes): it goes through the real mail service when credentials are set in `.env` (never committed), sent from `info@team-sober.com`; seeded `@sober.com` and reserved example domains always stay in Mailpit (`docs/runbooks/email-setup.md`).
- v1 UI is English only and light themes only: three themes (Sober default, Horizon, Orchid) chosen by a Super Admin for all users (`Planning/16-UX-Design.md` §7); all user-facing text goes through string catalogs and colours through theme tokens, never literal colours.
- Build UI from the chosen templates, don't hand-roll: shadcn/ui and its blocks (web, admin), React Native Reusables (mobile). Credit "Developed by Team Sober" (https://team-sober.com/, URL from config) in footers, the About screen, and emails.
- All tests must pass before every commit (git hooks + CI); never skip or disable tests to commit.
- Before reporting work as finished, make every running app serve the latest code and check it in the browser: rebuild and restart Docker (`docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d --build`) and wait until the new containers are up; open the web app (http://localhost:3000) and admin app (http://localhost:3001) and confirm the change is visible; make sure the mobile dev server (Metro, http://localhost:8081) serves the change, restarting it with `--clear` after config changes, and tell the user to reload Expo Go.
- Commit portion by portion with very short messages, authored only with the repository owner's configured git identity (`user.name` / `user.email`). Never add `Co-Authored-By` or any other AI attribution line to commits or pull requests.
- Keep costs low: prefer free tiers and self-hosted open-source tools (`Planning/12-Cost-Plan.md`).
- Every service emits OpenTelemetry logs, traces, and metrics for Grafana (`Planning/11-Observability.md`).
- Requirements stay at version 1.0; edit in place, don't add revision rows.
- When any requirement changes, update every affected document (requirements cross-references, `Planning/`, `Planning/Design/`, `specs/`, seed plan, README, CLAUDE.md) in the same change; a hook reminds you after each requirements edit.
