# Delivery Plan (Agile within the SDLC)

This plan explains how CareerPilot version 1 will be built: the SDLC phases, how Scrum runs inside them, the release roadmap, and the team's working agreements.

Source of truth for *what* to build: [Requirements.md](../Requirement%20Analysis/Requirements.md) (version 1.0).

## 1. SDLC phases and where we are

| Phase | Output | Status |
|---|---|---|
| 1. Requirements | Requirements document v1.0 | Done |
| 2. Planning | This `Planning/` folder: delivery plan, architecture, stack, data, AI design, backlog, standards | In progress |
| 3. Design | UX flows and screens (Figma), detailed data model, API contract (OpenAPI), ADRs | Sprint 0 and then just-in-time per sprint |
| 4. Build | Working increments of web app, mobile app, admin app, backend, and AI | Sprints 1–15 |
| 5. Test | Automated tests every sprint, plus hardening, security, accessibility, and beta testing | Every sprint, focused in Increment 5 |
| 6. Deploy | Dev → staging → production pipelines, app-store releases | Pipelines from Sprint 0; production launch at the end |
| 7. Maintain | Monitoring, incident handling, backlog for version 2 | After launch |

Phases 3–5 repeat inside every sprint (Agile). Phases 1–2 are mostly up front, but the requirements and plan are living documents: they are updated in place when a sprint teaches us something (requirements stay at version 1.0 until the Product Owner starts version 2).

## 2. Scrum setup

| Item | Agreement |
|---|---|
| Framework | Scrum |
| Sprint length | 2 weeks |
| Product Owner | Project owner (Saidul Islam Rajib): owns requirements, backlog order, and acceptance |
| Scrum Master | To be named (can be the same person in a small team) |
| Development team | Developers working with Claude Code (see [08-Developing-with-Claude.md](08-Developing-with-Claude.md)) |
| Backlog tool | GitHub Issues + GitHub Projects (board and roadmap views), in the same repository as the code |
| Estimation | Story points (Fibonacci), team velocity measured from Sprint 2 |

### Ceremonies

| Ceremony | When | Length | Purpose |
|---|---|---|---|
| Sprint planning | Day 1 | 2 h | Pick stories meeting Definition of Ready; agree sprint goal |
| Daily stand-up | Daily | 15 min | Progress, plan, blockers |
| Backlog refinement | Mid-sprint | 1 h | Split epics into stories, add acceptance criteria and requirement IDs |
| Sprint review | Last day | 1 h | Demo working software on web, mobile, and admin to the Product Owner |
| Retrospective | Last day | 45 min | Improve the process, including how we use Claude |

### Definition of Ready (a story can enter a sprint when)

- It references the requirement IDs it implements (for example `REQ-37.2-01`).
- It has acceptance criteria written as testable statements.
- UX is available for any screen it touches (web, mobile, or admin).
- API changes are described (endpoint, request, response) or marked "to design in sprint".
- Dependencies are done or scheduled earlier in the sprint.
- It fits in one sprint; otherwise it is split.

### Definition of Done (a story is done when)

- Code is merged to `main` through a reviewed pull request, with small commits.
- Unit and integration tests pass in CI; new behaviour has tests.
- It works on every platform the story covers (web, Android, iOS, admin).
- All new user-facing text is in the English string catalog (no hard-coded strings).
- Accessibility checks pass (keyboard, labels, contrast) for new screens.
- No secrets in code or logs; security checklist done for sensitive areas.
- API contract (OpenAPI) and generated clients are updated.
- Requirement and planning docs are updated if behaviour changed.
- The Product Owner has accepted it in the sprint review.

## 3. Release roadmap to version 1

All four parts (backend, AI, web app, mobile app) plus the admin app are built **in parallel in every increment**; nothing is postponed to after launch. Increments are internal milestones; the public launch is at the end of Increment 5.

Estimate assumption: a team of about 5–7 developers working with Claude Code. Velocity after Sprint 2 will be used to re-plan.

| Increment | Sprints | Goal | Main epics |
|---|---|---|---|
| 0. Foundation | Sprint 0 | Repo, CI/CD, environments, auth, design system, API skeleton, Temporal, observability | E01 |
| 1. Profile and discovery | 1–3 | A user can sign up on web and mobile, build a profile, configure tracks, and receive daily recommendations with archived circulars; admins see users and sources | E02, E03, E04, E05, E06, E07, E17 (basic), E18 (basic) |
| 2. Approve-each applications | 4–6 | A user approves an application and the system completes it automatically, with full submission records | E08, E09, E10, E11 |
| 3. Automatic mode | 7–8 | Rules, windows, pause, caps, emergency stop, reconciliation | E12, E13 |
| 4. Bangladesh and students | 9–11 | Government circulars and stages, Bangla OCR, master's/PhD journey, supervisor outreach | E14, E15 |
| 5. After applying and hardening | 12–15 | Inbox/calendar, interviews/offers, insights, fraud, compliance, security and accessibility testing, beta, store release | E16, E17, E18, E19, E20 |

Epic details and requirement mapping are in [06-Product-Backlog.md](06-Product-Backlog.md).

### Release gates

| Gate | Condition |
|---|---|
| Internal alpha (end of Increment 2) | Approve-each mode works end to end for email and at least two career-page systems; records are accurate |
| Closed beta (end of Increment 4) | All tracks working; automatic mode enabled only for tested routes; beta users invited |
| Production launch (end of Increment 5) | Every acceptance criterion in requirements Section 16 passed or has an approved limitation (requirements Section 25.3); security and privacy tests passed; apps approved by Google Play and Apple App Store |

## 4. Sprint 0 checklist

1. Create monorepo structure ([07-Engineering-Standards.md](07-Engineering-Standards.md)).
2. Add `CLAUDE.md` files and Claude Code settings ([08-Developing-with-Claude.md](08-Developing-with-Claude.md)).
3. Assign requirement IDs (requirements Section 55.2) and load epics/stories into GitHub Projects.
4. Local environment with Docker Compose (Postgres, Redis, MinIO, Temporal, Keycloak).
5. CI pipelines for backend, web, admin, mobile; deploy dev environment with Terraform.
6. Keycloak realms for users and admins; sign-in working on web, mobile, and admin.
7. API skeleton (user API and admin API), OpenAPI generation, typed TypeScript client.
8. Design system: tokens, base components for web and mobile, English/Bangla setup.
9. Observability (Sentry, OpenTelemetry) and audit-log foundation.
10. Resolve the blocking open decisions in [09-Risks-and-Decisions.md](09-Risks-and-Decisions.md).

## 5. Metrics

- Sprint velocity and say/do ratio.
- Escaped defects per sprint.
- Requirement coverage: share of requirement IDs with passing acceptance tests.
- Application accuracy in test environments: submission records that exactly match what was submitted (target 100%, requirements Section 52).
- AI evaluation scores per AI task ([05-AI-Design.md](05-AI-Design.md)).
