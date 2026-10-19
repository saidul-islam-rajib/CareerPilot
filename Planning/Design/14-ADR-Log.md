# Architecture Decision Records (Log)

Each decision is recorded as an ADR. Full ADR files go in `docs/adr/NNNN-title.md` from Sprint 0, using this format: **Context → Decision → Alternatives → Consequences → Status**. Status values: Proposed, Accepted, Superseded.

| ADR | Decision | Main alternatives | Consequences | Status |
|---|---|---|---|---|
| 0001 | Modular monolith with bounded contexts, worker pools, and an evolution path to services | Microservices from day one | Fast early delivery, simple operations; boundaries enforced in CI so extraction is possible later | Proposed |
| 0002 | Python for the backend; TypeScript for front ends | TypeScript everywhere | Best AI/OCR/automation ecosystem; two languages bridged by OpenAPI-generated clients | Proposed |
| 0003 | Temporal for durable workflows (applications, approvals, schedules, pauses, deletion) | Celery + Redis; AWS Step Functions | Strong guarantees for long waits and external actions; new skill for the team | Proposed |
| 0004 | PostgreSQL as system of record with pgvector and full-text search | Separate vector DB and search engine | One database to operate in v1; OpenSearch can be added as a projection later | Proposed |
| 0005 | Transactional outbox + EventBridge/SQS with CloudEvents envelope | Direct publishing; Kafka from day one | No lost events, idempotent consumers; Kafka possible later with same contracts | Proposed |
| 0006 | Hexagonal modules and a plugin registry for sources, routes, channels, transformers, country packs, eligibility checks, scoring features | Hard-coded integrations | New integrations without core changes; plugin interface versioning required | Proposed |
| 0007 | CEL for user and platform rules | Custom rule language; JSONLogic; code-only rules | Safe, typed, fast rules; rule builder UI needed | Proposed |
| 0008 | Metadata-driven opportunity types and fields (JSON Schema + UI schema) with dynamic forms | Code-defined types | New types/fields without releases; schema versioning and validation needed | Proposed |
| 0009 | Keycloak with separate `users` and `admins` realms | Managed identity services; custom auth | Full control, no per-user fees; must operate and patch Keycloak | Proposed |
| 0010 | Backend-for-Frontend pattern for web and admin (tokens server-side, httpOnly cookies) | Tokens in browser storage | Stronger protection against token theft; BFF layer to maintain | Proposed |
| 0011 | React Native + Expo for Android and iOS | Flutter; native apps | Shared TypeScript code with web; Expo build and update services | Proposed |
| 0012 | REST + OpenAPI 3.1; no GraphQL in v1 | GraphQL | Simpler security and caching; may revisit for complex screens | Proposed |
| 0013 | `tenant_id` on every row from day one (single tenant in v1) | Add tenancy later | Organizations can be added without data migration | Proposed |
| 0014 | Policy engine (Cedar or OPA) for authorization + Postgres row-level security | Authorization checks scattered in code | Central, testable permissions for admin roles and owners | Proposed (engine choice in Sprint 0) |
| 0015 | S3 Object Lock for archived circulars and submission evidence, with privacy-deletion process | Plain versioned storage | Tamper-proof records; deletion handled through controlled process and crypto-shredding | Proposed |
| 0016 | Claude Opus 5.5 for AI tasks via the official SDK, structured outputs, Batch API for bulk | Other models/providers | High quality extraction and writing; cost managed with caching, batching, budgets | Proposed |
| 0017 | AWS as cloud provider, Terraform for infrastructure | GCP, Azure | Broad managed services; region chosen for Bangladesh latency and law | Proposed |
| 0018 | OpenFeature-based feature flags managed from the admin app | Ad-hoc config flags | Safe gradual rollouts; flag hygiene process needed | Proposed |
| 0019 | Separate browser sandbox pool with egress proxy for automation | Automation inside general workers | Isolation of untrusted web content and credentials | Proposed |
| 0020 | Deterministic, versioned scoring in code; AI only for extraction and explanations | AI-computed scores | Reproducible, explainable scores; AI cost limited | Proposed |

All ADRs are accepted (or changed) by the Product Owner and tech lead during Sprint 0.
