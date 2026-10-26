# Developing with Claude

How Claude Code is used to build CareerPilot safely and quickly. Under AIDLC, the roles below are performed by the agents in [10-AIDLC-Agents.md](10-AIDLC-Agents.md); "humans" means the Product Owner at the checkpoints listed there. This is about *building* the product; the AI *inside* the product is covered in [05-AI-Design.md](05-AI-Design.md).

## 1. Setup (Sprint 0)

| Item | Purpose |
|---|---|
| `CLAUDE.md` (repo root) | Project overview, where the requirements and plans are, non-negotiable rules, commands |
| `CLAUDE.md` in `services/`, `apps/web`, `apps/admin`, `apps/mobile` | Stack-specific commands and conventions for that part |
| `.claude/settings.json` | Shared permissions: allow test, lint, and build commands; deny reading `.env*` and secret files; deny `git push --force` |
| Hooks | Format files after edits (ruff / Prettier); block commits containing secrets (gitleaks) |
| Project skills (`.claude/skills/`) | Repeatable recipes added as patterns settle, for example: new API endpoint, new source connector, new ATS adapter, new mobile screen, new AI task with eval |
| MCP servers (optional) | GitHub (issues, PRs), Figma (designs to code), Sentry (errors) |

## 2. Workflow for each story

1. **Pick a ready story** with requirement IDs and acceptance criteria (Definition of Ready, [01-Delivery-Plan.md](01-Delivery-Plan.md)).
2. **Plan first.** Ask Claude to read the relevant requirement sections and the code, then produce a plan in plan mode. A developer reviews and adjusts the plan before any code is written.
3. **Branch.** One branch per story. For parallel work on different apps, use separate git worktrees so sessions don't interfere.
4. **Build with tests.** Claude writes the tests for the acceptance criteria and corner cases together with the code, and runs them.
5. **Self-review.** Run `/code-review` on the branch. For authentication, credentials, automation, payments, or admin access, also run `/security-review`.
6. **Small commits.** Commit portion by portion with short messages (see [07-Engineering-Standards.md](07-Engineering-Standards.md) §2).
7. **Pull request.** Claude drafts the PR description (story link, requirement IDs, test evidence, screenshots); a human reviews and merges.
8. **Update docs.** If behaviour or a decision changed, update the requirements (in place, version 1.0), plans, or an ADR in the same PR.

## 3. Rules Claude must follow (also in `CLAUDE.md`)

- The requirements document is the source of truth. If code and requirements disagree, stop and ask; don't silently pick one.
- Use the single definitions: status model (requirements Section 20.2), precedence (38), user-only steps (27.3), pre-submission checks (27.4), pause (47), submission timing (49), circular archive (50), compensation (51), admin access (53).
- Never weaken a safeguard: no fabrication, no CAPTCHA solving or bot-detection evasion, no blind resubmission, no secrets in code or logs, no plain-text credentials.
- Never send real applications, payments, or other email from development, test, or CI environments. Only account email a person asks for themselves (registration and password-reset links, verification codes) may use the real mail service, and only when its credentials are set in `.env` (see `docs/runbooks/email-setup.md`).
- Every user-facing string goes through the string catalogs (English only in v1).
- Keep commits small, with short messages.

## 4. What humans always own

- Approving plans for new modules, workflows, and schema changes.
- Reviewing and merging every pull request.
- Security-sensitive code: identity, credential vault, automation safety, payments, admin permissions.
- Prompts for the product's AI features, and their evaluation results.
- Production database migrations, infrastructure changes, and releases.
- Store submissions and anything that touches real users' data.

## 5. Using Claude well

- Give Claude the story, the requirement IDs, and the files or folders involved; ask it to read before writing.
- Keep each session to one story. Start a new session for unrelated work.
- Ask for tests that prove the corner cases (time zones, duplicates, pauses, partial failures), not just the happy path.
- When Claude is unsure about a product rule, the answer belongs in the requirements, so update them rather than leaving the decision buried in code.
- Discuss in retrospectives what worked with Claude and turn good patterns into project skills.
