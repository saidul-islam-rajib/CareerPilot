# Risks and Open Decisions

## 1. Key risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Some job sites (for example LinkedIn) prohibit automated applying or scraping | Those routes can't be automated; user accounts could be restricted | Source registry records terms; such routes use guided manual apply; legal review of each major source before automation |
| R2 | Employer portals change layouts often | Adapters break; applications fail | Adapter health checks, admin alerts, fast fixes behind feature flags, fall back to manual guidance |
| R3 | Bangla and scanned circular extraction errors | Wrong deadlines or eligibility | Evidence + confidence, low-confidence fields marked unverified, Bangla eval set, admin correction tools |
| R4 | WhatsApp Business verification and template approval take time | Notifications delayed at launch | Start Meta business verification in Sprint 0; push and email as fallback |
| R5 | App store review of an app that applies to jobs automatically | Launch delay | Clear store descriptions, user consent screens, beta through TestFlight and Play internal testing early |
| R6 | Storing portal passwords makes the platform a high-value target | Serious harm if breached | KMS envelope encryption, no read-back API, strict access, audit, security testing, prefer OAuth/SSO where portals allow |
| R7 | AI costs grow with users and postings | Budget overrun | Prompt caching, batch processing, per-user budgets, cost dashboard, model choice decision backed by evals |
| R8 | Large scope for version 1 | Late launch | Parallel increments, velocity-based re-planning, strict Definition of Done |
| R9 | Email deliverability and user mailbox limits | Applications land in spam or fail | Send from the user's own mailbox, respect limits, monitor bounces |
| R10 | Data-protection obligations (Bangladesh law, GDPR for EU employers) | Legal exposure | Privacy notice, consent records, export/deletion, data-processing agreements with providers |
| R11 | Mass automated applications look like spam to employers | Harm to users' reputation | Thresholds, hard filters, caps, per-employer limits, quality checks |

## 2. Technical decisions to make in Sprint 0

| # | Decision | Options | Recommendation |
|---|---|---|---|
| T1 | AWS region | Mumbai (`ap-south-1`), Singapore (`ap-southeast-1`) | Mumbai for latency, subject to data-protection review |
| T2 | Temporal hosting | Temporal Cloud, self-hosted | Temporal Cloud at the start (less operations work) |
| T3 | Embedding provider | Hosted multilingual embedding API, self-hosted open model | Decide by Bangla/English retrieval eval |
| T4 | Authentication | Keycloak self-hosted, managed identity service | Keycloak (two realms, MFA, no per-user fees) |
| T5 | Model for high-volume extraction | Claude Opus 5.5 everywhere, or a cheaper Claude model for nightly extraction | Start with Opus 5.5; switch only if evals show equal quality and the Product Owner approves the cost trade-off |
| T6 | Product analytics | PostHog cloud, PostHog self-hosted | PostHog cloud with consent |
| T7 | Error tracking | Sentry cloud, self-hosted | Sentry cloud |
| T8 | Initial ATS adapters | Greenhouse, Lever, Workday, SmartRecruiters, Ashby, and others | Pick 2–3 by how often they appear in our target sources |
| T9 | Initial sources | Government notice sites, local portals, employer career pages, university pages | Pick by permission and coverage per track |
| T10 | Authorization policy engine | Cedar, OPA | Cedar (simple, typed policies for roles and ownership) |
| T11 | Feature flag provider (OpenFeature) | Self-hosted flag service, database-backed provider | Database-backed provider managed from the admin app, unless a flag service is preferred |
| T12 | Accept the 20 proposed ADRs | — | Review [Design/14-ADR-Log.md](Design/14-ADR-Log.md) in Sprint 0 |

## 3. Product decisions

Open product decisions are listed in requirements Section 54. Decisions that block early sprints:

- Section 54 items 1–4 (meaning of tracks, thresholds, and result counts): needed for Increment 1.
- Items 5–6 and 11 (initial countries, sources, academic priorities): needed for Increment 1.
- Items 7–9, 22–23, 36–38, 43–47 (automation, approval, and reuse rules): needed for Increments 2–3.
- Items 25, 48–49 (laws, standards, minimum age): needed before beta.
- Item 59 (minimum Android and iOS versions): needed in Sprint 0.
