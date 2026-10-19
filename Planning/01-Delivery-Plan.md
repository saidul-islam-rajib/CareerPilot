# Delivery Plan (AIDLC)

This plan explains how CareerPilot version 1 will be built: the lifecycle phases, the delivery cadence, the release roadmap, and the working agreements. Delivery follows **AIDLC (AI-Driven Development Lifecycle)**: AI agents do the work and the Product Owner validates at checkpoints. Agent roles, triggers, and the self-healing loop are in [10-AIDLC-Agents.md](10-AIDLC-Agents.md). Wherever this document says "sprint", read it as the equivalent group of bolts (about two weeks of work).

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

These phases map to the AIDLC phases: Requirements, Planning, and Design form **Inception**; Build and Test form **Construction**; Deploy and Maintain form **Operations**. Construction work repeats in short bolts. The requirements and plans are living documents, updated in place when work teaches us something (requirements stay at version 1.0 until the Product Owner starts version 2).

## 2. AIDLC setup

| Item | Agreement |
|---|---|
| Lifecycle | AIDLC: Inception → Construction → Operations, with continuous feedback from production ([10-AIDLC-Agents.md](10-AIDLC-Agents.md)) |
| Work unit | **Bolt**: hours to a few days, one tested unit of work; bolts grouped into increments |
| Product Owner | Project owner (Saidul Islam Rajib): owns requirements, priorities, and validation at checkpoints |
| Workforce | AIDLC agents (Business Analyst, Planner, Architect, UX/UI, developers, testers, reviewers, performance, capacity, DevOps, SRE, Auto-Fix, compliance, documentation), coordinated by the Orchestrator agent |
| Backlog tool | GitHub Issues + GitHub Projects (board and roadmap views), in the same repository as the code |
| Estimation | Agent effort and cost per bolt; throughput measured from the first increment |

### Checkpoints (replace ceremonies)

| Checkpoint | When | Purpose |
|---|---|---|
| Inception review | Start of each increment | Product Owner validates stories, designs, and screen specs prepared by agents |
| Bolt completion | End of each bolt (automatic) | All quality gates pass ([14-Testing-and-Quality.md](14-Testing-and-Quality.md)); agents merge non-sensitive work |
| Sensitive change review | As needed | Product Owner approves auth, credentials, payments, automation safety, deletion, schema changes |
| Increment demo | End of each increment | Working software on web, Android, iOS, and admin |
| Monthly review | Monthly | Cost, capacity, quality, and agent performance; process improvements |

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
- All tests passed locally before every commit (git hooks) and in CI.
- Accepted: automatically for non-sensitive work when all gates pass; by the Product Owner for sensitive changes and at the increment demo.

## 3. Release roadmap to version 1

All four parts (backend, AI, web app, mobile app) plus the admin app are built **in parallel in every increment**; nothing is postponed to after launch. Increments are internal milestones; the public launch is at the end of Increment 5.

AIDLC agents do the work in parallel (one git worktree per agent). The sprint numbers below are size estimates; the real timeline is re-planned after Increment 1 from measured bolt throughput, agent cost, and Product Owner availability for checkpoints.

| Increment | Sprints | Goal | Main epics |
|---|---|---|---|
| 0. Foundation | Sprint 0 | Repo, Docker local platform, CI/CD, git hooks, AIDLC agents, auth, design system, API skeleton, Temporal, Grafana observability | E01, E22, E23 |
| 1. Profile and discovery | 1–3 | A user can sign up on web and mobile, build a profile, configure tracks, and receive daily recommendations with archived circulars; admins see users and sources | E02, E03, E04, E05, E06, E07, E17 (basic), E18 (basic) |
| 2. Approve-each applications | 4–6 | A user approves an application and the system completes it automatically, with full submission records | E08, E09, E10, E11 |
| 3. Automatic mode | 7–8 | Rules, windows, pause, caps, emergency stop, reconciliation | E12, E13 |
| 4. Bangladesh and students | 9–11 | Government circulars and stages, Bangla OCR, master's/PhD journey, supervisor outreach | E14, E15 |
| 5. After applying and hardening | 12–15 | Inbox/calendar, interviews/offers, insights, fraud, integrations and payments, compliance, security, accessibility and load testing, beta, Play Store release | E16, E17, E18, E19, E20, E21 |

Epic details and requirement mapping are in [06-Product-Backlog.md](06-Product-Backlog.md).

### Release gates

| Gate | Condition |
|---|---|
| Internal alpha (end of Increment 2) | Approve-each mode works end to end for email and at least two career-page systems; records are accurate |
| Closed beta (end of Increment 4) | All tracks working; automatic mode enabled only for tested routes; beta users invited |
| Production launch (end of Increment 5) | Every acceptance criterion in requirements Section 16 passed or has an approved limitation (requirements Section 25.3); security, privacy, and load tests passed; Android app approved on Google Play (App Store when the Apple developer account is set up) |

## 4. Sprint 0 checklist

1. Create monorepo structure ([07-Engineering-Standards.md](07-Engineering-Standards.md)).
2. Add `CLAUDE.md` files, Claude Code settings, git hooks, and AIDLC agent definitions ([10-AIDLC-Agents.md](10-AIDLC-Agents.md), [13-Local-Development.md](13-Local-Development.md)).
3. Assign requirement IDs (requirements Section 55.2) and load epics/stories into GitHub Projects.
4. Local platform with Docker Compose: all services, mocks, and Grafana stack ([13-Local-Development.md](13-Local-Development.md)).
5. CI pipelines for backend, web, admin, mobile; deploy dev environment with Terraform.
6. Keycloak realms for users and admins; sign-in working on web, mobile, and admin.
7. API skeleton (user API and admin API), OpenAPI generation, typed TypeScript client.
8. Design system: light-theme tokens, base components for web and mobile, English string catalogs ([16-UX-Design.md](16-UX-Design.md)).
9. Observability (OpenTelemetry, Grafana, Sentry for mobile crashes) and audit-log foundation ([11-Observability.md](11-Observability.md)).
10. Resolve the blocking open decisions in [09-Risks-and-Decisions.md](09-Risks-and-Decisions.md).

## 5. Metrics

- Bolt throughput, rework rate, and agent cost per bolt.
- Escaped defects per increment; automatic fix success rate in production.
- Requirement coverage: share of requirement IDs with passing acceptance tests.
- Application accuracy in test environments: submission records that exactly match what was submitted (target 100%, requirements Section 52).
- AI evaluation scores per AI task ([05-AI-Design.md](05-AI-Design.md)).
