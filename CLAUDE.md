# CareerPilot

Job discovery and application assistant for job seekers and students (Bangladesh and international). Version 1 is being built with Agile (Scrum, 2-week sprints).

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

(Folders are created in Sprint 0; see `Planning/07-Engineering-Standards.md`.)

## Non-negotiable rules

- If code and requirements disagree, stop and ask. Don't silently choose.
- Use the single definitions in the requirements: status model (§20.2), precedence (§38), user-only steps (§27.3), pre-submission checks (§27.4), pause (§47), submission timing (§49), circular archive (§50), compensation (§51), admin access (§53).
- Never fabricate user facts, never solve CAPTCHAs or evade bot detection, never resubmit when the outcome is unknown, never log or return secrets or plain-text credentials.
- Never send real applications, emails, or payments from local, dev, test, staging, or CI.
- v1 UI is English only and light theme only; all user-facing text still goes through string catalogs and colours through design tokens (so Bangla and dark mode can be added later).
- Commit portion by portion with very short messages.
- Requirements stay at version 1.0; edit in place, don't add revision rows.
