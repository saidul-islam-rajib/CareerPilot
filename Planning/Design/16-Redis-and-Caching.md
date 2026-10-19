# Redis and Caching

Redis is used for speed and coordination, **never as the source of truth**. PostgreSQL (and Temporal for workflow state) remain authoritative; losing Redis must never lose data or cause a duplicate external action.

## 1. Two Redis roles

| Instance | Purpose | Eviction policy | Persistence |
|---|---|---|---|
| `redis-cache` | Read caches (data that can be rebuilt) | `allkeys-lru` (evict least-recently used when full) | None |
| `redis-coord` | Sessions, rate limits, locks, idempotency guards, verification codes, real-time fan-out, circuit-breaker state | `noeviction` (never silently drop coordination keys) | AOF (append-only file) every second |

At the lean launch stage both run as small containers on the same host; at the growth stage they move to managed ElastiCache. Separating them prevents cache pressure from evicting sessions or rate-limit counters.

## 2. Where Redis is used

| # | Use | Instance | Key pattern | Structure | TTL |
|---|---|---|---|---|---|
| 1 | Metadata cache (opportunity types, profile field definitions, countries, platform settings, feature flags, templates) | cache | `cp:{env}:meta:{name}:v{version}` | String (JSON) | 1 h, invalidated by `administration.setting.changed` / `flag.changed` events |
| 2 | Opportunity detail cache | cache | `cp:{env}:opp:{id}:v{version}` | String (JSON) | 6 h; version in key, so updates never serve stale data |
| 3 | Daily recommendations per user/track | cache | `cp:{env}:rec:{user}:{track}:{date}` | String (JSON list of IDs) | Until end of day (user time zone) |
| 4 | Dashboard / admin metric read models | cache | `cp:{env}:dash:{scope}:{key}` | String / Hash | 1–5 min |
| 5 | Authorization decision cache | cache | `cp:{env}:authz:{actor}:{resource}:{action}` | String | 60 s; cleared on role/policy change |
| 6 | Web and admin BFF sessions | coord | `cp:{env}:sess:{session_id}` | Hash (encrypted token set) | Session idle timeout (admin shorter) |
| 7 | Rate limiting (per user, IP, endpoint; per source; per route; per mailbox; AI budgets) | coord | `cp:{env}:rl:{subject}:{window}` | Token bucket via Lua script | Window length |
| 8 | Login protection (failed attempts, lockout timers) | coord | `cp:{env}:auth:fail:{account}` | Counter | 15–60 min |
| 9 | Verification codes (email/phone OTP) and resend throttles | coord | `cp:{env}:otp:{purpose}:{target}` | Hash (hashed code, attempts) | 10 min |
| 10 | Idempotency fast check (the database remains authoritative) | coord | `cp:{env}:idem:{key}` | String (status/result ref) | 24 h |
| 11 | Short distributed locks (for example one digest build per user, one refresh per source) | coord | `cp:{env}:lock:{name}` | `SET NX PX` + fencing token | Seconds; never used to guarantee exactly-once submissions (Temporal + DB do that) |
| 12 | Real-time fan-out for SSE (status updates to all API instances) | coord | `cp:{env}:rt:user:{user}` | Pub/Sub or Streams | — |
| 13 | Circuit-breaker and plugin health state shared across workers | coord | `cp:{env}:cb:{plugin}` | Hash | Rolling window |
| 14 | Notification de-duplication (same notification not sent twice in a short window) | coord | `cp:{env}:ndup:{user}:{hash}` | String | 1–24 h |
| 15 | Upload progress and resumable upload state | coord | `cp:{env}:upl:{upload_id}` | Hash | 24 h |
| 16 | Embedding cache for repeated texts (question meaning, skills) | cache | `cp:{env}:emb:{model}:{sha256}` | String (binary vector) | 30 days |

## 3. Patterns and rules

- **Cache-aside**: read cache → on miss read PostgreSQL → write cache with TTL. Writes go to PostgreSQL first; caches are invalidated by domain events (outbox consumers), with versioned keys where possible.
- **Every key has a TTL** (except coordination keys whose lifetime is explicit), a namespace prefix `cp:{env}:`, and a documented owner module.
- **No personal data in cache keys**; values with personal data are encrypted or limited to IDs where possible.
- **Stampede protection**: single-flight lock on rebuild, plus random TTL jitter (±10%).
- **Negative caching** for "not found" lookups, with short TTLs.
- **Size limits**: values under 512 KB; large objects live in S3 and are referenced by key.
- **Serialization**: JSON for readability (MessagePack where size matters), with a schema version field.
- **Failure behaviour**:
  - Cache unavailable → read from PostgreSQL (slower but correct).
  - Rate limiter unavailable → fail closed for sign-in, registration, OTP, and external-action endpoints; fail open (with logging) for read endpoints.
  - Sessions unavailable → users sign in again; no data loss.
  - Locks unavailable → jobs wait and retry; correctness never depends on Redis locks.

## 4. Observability and capacity

- Metrics: hit rate per cache, memory use, evictions, connected clients, command latency, keys per namespace, AOF status.
- Alerts: hit rate drop, memory > 75%, any eviction on `redis-coord`, latency spikes.
- The Capacity/Cost agent reviews key growth weekly and adjusts TTLs or memory size.

## 5. Testing

- Unit tests use an in-memory Redis fake (no real Redis in tests).
- Tests cover cache invalidation by events, rate-limit behaviour at limits, lock expiry, session expiry, and the failure behaviours in §3 (Redis stopped mid-test).
