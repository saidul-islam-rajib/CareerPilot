# Risks and Open Decisions

## 1. Key risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Some job sites (for example LinkedIn) prohibit automated applying or scraping | Those routes can't be automated; user accounts could be restricted | Source registry records terms; such routes use guided manual apply; legal review of each major source before automation |
| R2 | Employer portals change layouts often | Adapters break; applications fail | Adapter health checks, admin alerts, fast fixes behind feature flags, fall back to manual guidance |
| R3 | Bangla and scanned circular extraction errors | Wrong deadlines or eligibility | Evidence + confidence, low-confidence fields marked unverified, Bangla unit-test fixtures, admin correction tools |
| R4 | WhatsApp Business verification and template approval take time | Notifications delayed at launch | Start Meta business verification in Sprint 0; push and email as fallback |
| R5 | App store review of an app that applies to jobs automatically | Launch delay | Clear store descriptions, user consent screens, beta through TestFlight and Play internal testing early |
| R6 | Storing portal passwords makes the platform a high-value target | Serious harm if breached | KMS envelope encryption, no read-back API, strict access, audit, security testing, prefer OAuth/SSO where portals allow |
| R7 | AI costs grow with users and postings | Budget overrun | Prompt caching, batch processing, per-user budgets, cost dashboard, model choice decision backed by evals |
| R8 | Large scope for version 1 | Late launch | Parallel increments, velocity-based re-planning, strict Definition of Done |
| R9 | Email deliverability and user mailbox limits | Applications land in spam or fail | Send from the user's own mailbox, respect limits, monitor bounces |
| R10 | Data-protection obligations (Bangladesh law, GDPR for EU employers) | Legal exposure | Privacy notice, consent records, export/deletion, data-processing agreements with providers |
| R11 | Mass automated applications look like spam to employers | Harm to users' reputation | Thresholds, hard filters, caps, per-employer limits, quality checks |
| R12 | Automatic fixes by agents introduce new bugs | Production regressions | Reproduction test first, full test suite, reviewer agents, canary deploy with automatic rollback, human approval for sensitive areas |
| R13 | Agent and AI usage cost exceeds the small budget | Budget overrun | Daily agent and AI budgets, cost dashboard, model-per-task decision (T5), Batch API, caching |
| R14 | Single instance at launch is a single point of failure | Downtime during instance failure | Automated backups, infrastructure as code for fast rebuild, health checks with auto-recovery, move to growth stage when usage justifies |
| R15 | Google Play closed-testing requirement delays launch | Later Play Store release | Recruit beta testers early; start closed testing as soon as Increment 2 is stable |
| R16 | WhatsApp per-message fees | Ongoing cost | Push and email first; WhatsApp for urgent messages only; per-user limits |
| R17 | Grafana Cloud free-tier limits exceeded | Lost telemetry or cost | Sampling, log levels, retention settings; self-hosted fallback |

## 2. Technical decisions to make in Sprint 0

| # | Decision | Options | Recommendation |
|---|---|---|---|
| T1 | AWS region | Mumbai (`ap-south-1`), Singapore (`ap-southeast-1`) | Mumbai for latency, subject to data-protection review |
| T2 | Temporal hosting | Temporal Cloud, self-hosted | Self-hosted container at launch (free); Temporal Cloud only at scale |
| T3 | Embedding provider | Hosted multilingual embedding API, self-hosted open model | Decide by Bangla/English retrieval eval |
| T4 | Authentication | Keycloak self-hosted, managed identity service | Keycloak (two realms, MFA, no per-user fees) |
| T5 | Model per AI task | Claude Opus 5.5 everywhere, or a smaller Claude model (for example Claude Haiku 5.5) for high-volume tasks such as extraction and classification | Plan uses Opus 5.5; given the low budget, decide per task using eval results and the cost comparison in [12-Cost-Plan.md](12-Cost-Plan.md) §5 |
| T6 | Product analytics | PostHog cloud, PostHog self-hosted | PostHog cloud with consent |
| T7 | Error tracking | Sentry cloud, self-hosted | Sentry cloud |
| T8 | Initial ATS adapters | Greenhouse, Lever, Workday, SmartRecruiters, Ashby, and others | Pick 2–3 by how often they appear in our target sources |
| T9 | Initial sources | Government notice sites, local portals, employer career pages, university pages | Pick by permission and coverage per track |
| T10 | Authorization policy engine | Cedar, OPA | Cedar (simple, typed policies for roles and ownership) |
| T11 | Feature flag provider (OpenFeature) | Self-hosted flag service, database-backed provider | Database-backed provider managed from the admin app, unless a flag service is preferred |
| T12 | Accept the 20 proposed ADRs | — | Review [Design/14-ADR-Log.md](Design/14-ADR-Log.md) in Sprint 0 |
| T13 | Payment providers to support first | SSLCommerz, bKash, Nagad, international card gateway | Choose by merchant availability and fees ([Design/15-Integrations-and-Payments.md](Design/15-Integrations-and-Payments.md)) |
| T14 | Monitoring hosting | Grafana Cloud free tier, self-hosted Grafana stack | Grafana Cloud free tier at launch |
| T15 | Agent runner for production self-healing | GitHub Actions with Claude Code, scheduled cloud agents, self-hosted runner | GitHub Actions with Claude Code (triggered by alert webhooks) |

## 3. Product decisions

Open product decisions are listed in requirements Section 54. Decisions that block early sprints:

- Section 54 items 1–4 (meaning of tracks, thresholds, and result counts): needed for Increment 1.
- Items 5–6 and 11 (initial countries, sources, academic priorities): needed for Increment 1.
- Items 7–9, 22–23, 36–38, 43–47 (automation, approval, and reuse rules): needed for Increments 2–3.
- Items 25, 48–49 (laws, standards, minimum age): needed before beta.
- Item 59 (minimum Android and iOS versions): needed in Sprint 0.
