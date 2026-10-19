# CareerPilot Planning

Planning documents for version 1. The requirements they implement are in [Requirements.md](../Requirement%20Analysis/Requirements.md).

| Document | What it answers |
|---|---|
| [01-Delivery-Plan.md](01-Delivery-Plan.md) | How we work (SDLC + Scrum), roadmap, release gates, Sprint 0 checklist |
| [02-Architecture.md](02-Architecture.md) | How the system is structured, key flows, application routes, security, environments |
| [03-Technology-Stack.md](03-Technology-Stack.md) | Which technologies we use and why |
| [04-Data-and-Storage.md](04-Data-and-Storage.md) | Which database or store holds which data, entities, encryption, backups |
| [05-AI-Design.md](05-AI-Design.md) | How Claude and machine learning are used, guardrails, evaluation |
| [06-Product-Backlog.md](06-Product-Backlog.md) | Epics mapped to requirements, platforms, and increments |
| [07-Engineering-Standards.md](07-Engineering-Standards.md) | Repo layout, branching, commits, CI/CD, testing, coding rules |
| [08-Developing-with-Claude.md](08-Developing-with-Claude.md) | How the team builds with Claude Code |
| [09-Risks-and-Decisions.md](09-Risks-and-Decisions.md) | Risks, mitigations, and decisions still open |
| [10-AIDLC-Agents.md](10-AIDLC-Agents.md) | AI-Driven Development Lifecycle: agent roster, triggers, human checkpoints, self-healing loop |
| [11-Observability.md](11-Observability.md) | Logs, traces, metrics, profiles, errors in Grafana; dashboards, alerts, AIOps |
| [12-Cost-Plan.md](12-Cost-Plan.md) | Low-cost lean launch, free services, paid items, AI cost, guardrails |
| [13-Local-Development.md](13-Local-Development.md) | One solution folder, Docker local platform, commands, git hooks |
| [14-Testing-and-Quality.md](14-Testing-and-Quality.md) | Unit-test scope (the only test type in v1), sign-in/registration unit tests, coverage, quality gates |
| [15-Mobile-and-Play-Store.md](15-Mobile-and-Play-Store.md) | Android and iOS support, release pipeline, Google Play checklist |
| [16-UX-Design.md](16-UX-Design.md) | UX principles, navigation, key screens, master profile, image viewer, drag and drop, responsive layout, light-theme visual design |
| [17-Project-Structure.md](17-Project-Structure.md) | Canonical solution folder structure, specs, test naming |
| [18-Seed-Data.md](18-Seed-Data.md) | Seed data for every table, profiles, local default accounts |
| [Design/](Design/README.md) | Full architecture and design, high level to low level: principles, C4 diagrams, domain model, components, extensibility, data model, state machines, sequences, API, events, front ends, security, infrastructure, ADRs |

## Stack at a glance

- **Backend:** Python, FastAPI, PostgreSQL + pgvector, Redis, S3, Temporal, Playwright
- **AI:** Claude Opus 5.5 via the Anthropic Python SDK; multilingual embeddings
- **User web app and admin app:** Next.js + TypeScript (two separate apps)
- **Mobile app:** React Native + Expo (Android and iOS)
- **Infrastructure:** AWS (lean single-instance launch with Docker Compose), Terraform, GitHub Actions, Expo EAS
- **Observability:** OpenTelemetry + Grafana (Cloud free tier); Sentry free plan for mobile crashes
- **Delivery:** AIDLC with AI agents; everything runs locally in Docker
