# C4 Level 1 and Level 2: System Context and Containers

The C4 model describes the system at four zoom levels: Context (L1), Containers (L2), Components (L3, see [04-Component-Design.md](04-Component-Design.md)), and Code (L4, interfaces in the same document).

## 1. Level 1: System context

```mermaid
flowchart TB
  user(["Job seeker / student<br/>(web + Android + iOS)"])
  admin(["Administrator<br/>(admin web app)"])
  referee(["Referee / professor / recruiter<br/>(receives emails)"])

  cp["CareerPilot platform"]

  subgraph ext_jobs["Opportunity sources and destinations"]
    src["Job sources<br/>career pages, job boards,<br/>university and lab pages"]
    gov["Bangladesh government<br/>notice sites and portals"]
    ats["Applicant-tracking systems<br/>and university portals"]
  end

  subgraph ext_comm["Communication"]
    mail["User mailbox<br/>Gmail / Microsoft 365"]
    cal["User calendar"]
    wa["WhatsApp Business"]
    push["Push services<br/>FCM / APNs"]
    ses["System email service"]
  end

  subgraph ext_ai["AI providers"]
    claude["Claude API"]
    emb["Embedding provider"]
  end

  user -->|"profile, approvals,<br/>records"| cp
  admin -->|"manage platform"| cp
  cp -->|"discover"| src & gov
  cp -->|"apply, track"| ats & gov
  cp -->|"send applications,<br/>read replies"| mail
  mail -->|"emails"| referee
  cp -->|"deadlines, interviews"| cal
  cp -->|"notify, quick actions"| wa & push & ses
  cp -->|"extract, write, classify"| claude
  cp -->|"embeddings"| emb
```

## 2. Level 2: Containers

```mermaid
flowchart TB
  subgraph clients["Clients"]
    web["User web app<br/>Next.js (BFF for tokens)"]
    mob["User mobile app<br/>Expo React Native"]
    adm["Admin web app<br/>Next.js (BFF)"]
  end

  subgraph edge["Edge"]
    cdn["CloudFront + WAF"]
    idp["Identity provider<br/>Keycloak: users realm, admins realm"]
  end

  subgraph app["Application tier (private subnets)"]
    uapi["User API<br/>FastAPI + SSE"]
    aapi["Admin API<br/>FastAPI"]
    tmp["Temporal<br/>(workflow engine)"]
    subgraph workers["Worker pools (Temporal task queues)"]
      wdisc["Discovery workers"]
      wai["AI / extraction workers"]
      wmatch["Matching workers"]
      wapp["Application workers<br/>(Playwright browser sandbox)"]
      wnot["Notification workers"]
      wsync["Mail and calendar sync workers"]
      wops["Ops workers<br/>reconciliation, retention, reports"]
    end
    relay["Outbox relay"]
    bus["Event bus<br/>EventBridge + SQS"]
  end

  subgraph data["Data tier"]
    pg[("PostgreSQL primary<br/>+ pgvector")]
    pgr[("Read replica<br/>reports, admin dashboard")]
    redis[("Redis")]
    s3[("S3<br/>documents, archive, evidence")]
    kms["KMS + Secrets Manager"]
  end

  web & mob & adm --> cdn
  web & mob -.OIDC.-> idp
  adm -.OIDC.-> idp
  cdn --> uapi
  cdn --> aapi
  uapi & aapi --> pg & redis & s3
  aapi --> pgr
  uapi & aapi -->|"start / signal workflows"| tmp
  tmp <--> workers
  workers --> pg & s3 & redis
  wapp --> kms
  pg --> relay --> bus
  bus --> workers
  bus --> uapi
```

## 3. Container catalogue

At launch (lean stage, [../12-Cost-Plan.md](../12-Cost-Plan.md)) all application containers, Keycloak, Temporal, and Redis run on one instance; the containers and their responsibilities are the same.

| Container | Technology | Responsibility | Scales by | Notes |
|---|---|---|---|---|
| User web app | Next.js, TypeScript | All user features in a browser; server side acts as a Backend-for-Frontend that keeps tokens in httpOnly cookies | Stateless instances | [11-Frontend-Architecture.md](11-Frontend-Architecture.md) |
| User mobile app | Expo React Native | All user features on Android and iOS; push actions; offline viewing | Devices | Tokens in secure storage |
| Admin web app | Next.js, TypeScript | Admin dashboard and management | Stateless instances | Separate domain; admin realm only |
| Identity provider | Keycloak | Sign-in, MFA, passkeys, sessions, two realms | Clustered | Admin realm requires MFA |
| User API | Python FastAPI | REST API for web and mobile; real-time updates via Server-Sent Events | CPU / requests | Owner-scoped access only |
| Admin API | Python FastAPI (same codebase, different entry point) | REST API for admin app | CPU / requests | Separate network path and database role |
| Temporal | Temporal Cloud or self-hosted | Durable workflows, timers, signals, retries | Managed | Orchestrates all long-running work |
| Discovery workers | Python | Run source connectors, store raw snapshots | Task-queue backlog | Rate limits per source |
| AI / extraction workers | Python + Anthropic SDK | Extraction, writing, classification, claim checks, embeddings | Backlog + AI budget | Batch API for nightly work |
| Matching workers | Python | Hard filters, scoring, recommendations | Backlog | Deterministic, versioned scoring |
| Application workers | Python + Playwright | Fill and submit forms, send emails, collect evidence | Browser pool size | Isolated container per session |
| Notification workers | Python | Push, WhatsApp, email, digests, reports | Backlog | Fallback channels |
| Sync workers | Python | Mailbox and calendar sync | Connected accounts | Minimum OAuth scopes |
| Ops workers | Python | Reconciliation, retention, exports, account deletion, materialized views | Schedule | Read replica where possible |
| Outbox relay | Python | Publishes committed outbox events to the bus | Single active + standby | Guarantees no lost events |
| Event bus | EventBridge + SQS (DLQ per consumer) | Asynchronous integration between contexts | Managed | Replaceable by Kafka later |
| PostgreSQL | Amazon RDS | System of record; schemas per context | Vertical + read replicas; partitioning | Row-level security |
| Redis | ElastiCache | Cache, rate limits, short locks | Cluster | Never the source of truth |
| S3 | Amazon S3 | Documents, circular archive, evidence, exports | Managed | Versioning, Object Lock for evidence |
| KMS / Secrets Manager | AWS | Encryption keys, app secrets | Managed | Envelope encryption for credentials |
