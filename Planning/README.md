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
| [Design/](Design/README.md) | Full architecture and design, high level to low level: principles, C4 diagrams, domain model, components, extensibility, data model, state machines, sequences, API, events, front ends, security, infrastructure, ADRs |

## Stack at a glance

- **Backend:** Python, FastAPI, PostgreSQL + pgvector, Redis, S3, Temporal, Playwright
- **AI:** Claude Opus 5.5 via the Anthropic Python SDK; multilingual embeddings
- **User web app and admin app:** Next.js + TypeScript (two separate apps)
- **Mobile app:** React Native + Expo (Android and iOS)
- **Infrastructure:** AWS, Terraform, GitHub Actions, Expo EAS
