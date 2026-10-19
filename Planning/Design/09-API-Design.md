# API Design

## 1. Style and decisions

| Topic | Decision | Reason |
|---|---|---|
| Style | REST, resource-oriented, JSON over HTTPS | Simple, cacheable, well-supported on web and mobile |
| Contract | OpenAPI 3.1 generated from FastAPI + Pydantic; committed to `docs/api/` | Single source for typed clients |
| Two APIs | User API (`api.<domain>/v1`) and Admin API (`admin-api.<domain>/v1`) | Separate access points and permissions (requirements Section 53.1) |
| GraphQL | Not used in v1 | REST + field selection covers needs; simpler caching, security, and rate limiting. Revisit if clients need many joins per screen |
| Real-time | Server-Sent Events for web (`/v1/events/stream`); push + refetch for mobile in background | Live status updates without polling |
| Long-running work | `202 Accepted` + operation resource (`/v1/operations/{id}`) | Résumé import, exports, dry runs |
| Files | Presigned S3 upload/download URLs; completion call registers the version | Large files never pass through the API |
| Partner integrations (future) | Outbound webhooks (signed) and partner API with OAuth client credentials and scopes | Growth (Stage 3) |

## 2. Conventions

| Topic | Convention |
|---|---|
| Versioning | URI major version (`/v1`). Within a version only additive, backwards-compatible changes. Breaking changes → `/v2` with a deprecation period and `Deprecation`/`Sunset` headers. Mobile apps check a minimum supported version on start |
| Naming | Plural nouns, kebab-case paths, snake_case JSON fields, ISO 8601 times with offsets, ISO 4217 currencies, ISO 3166 countries |
| IDs | UUIDv7 strings |
| Pagination | Cursor based: `?limit=50&cursor=...` → `{ "items": [...], "next_cursor": "..." }` |
| Filtering and sorting | `?filter[status]=confirmed&filter[track_id]=...&sort=-submitted_at` |
| Field selection | `?fields=id,title,deadline` for lean mobile payloads |
| Errors | RFC 9457 `application/problem+json` with stable `type` URIs, `code`, `detail`, `field_errors`, and `trace_id` |
| Idempotency | `Idempotency-Key` header required on POSTs that start external actions or create records; repeated keys return the original result |
| Concurrency | `ETag` on resources; `If-Match` required on updates; `412` on conflict |
| Rate limits | Per user and per IP; `RateLimit-*` headers; `429` with `Retry-After` |
| Localization | `Accept-Language` (`en`, `bn`) for messages; data keeps original language plus translations where provided |
| Time zones | Client sends the user's time zone in profile; server returns UTC plus original time zone fields |
| Security | OAuth 2.1 / OIDC bearer tokens (mobile) or BFF session cookie → token (web); scopes and policies per endpoint |
| Tracing | `traceparent` header accepted and returned |

## 3. User API resource catalogue (v1)

| Area | Endpoints (main) | Requirement sections |
|---|---|---|
| Account | `GET/PATCH /me`, `POST /me/deletion-request`, `DELETE /me/deletion-request`, `GET /me/sessions`, `DELETE /me/sessions`, `POST /me/exports` | 41, 46.2 |
| Onboarding | `GET /onboarding`, `POST /onboarding/steps/{step}` | 17 |
| Profile | `GET /profile`, `PATCH /profile/facts`, `GET/POST/PATCH/DELETE /profile/{educations,employments,test-scores,referees,links,identity-details}`, `GET /profile/history`, `POST /profile/history/{id}/undo`, `GET /profile/readiness` | 5.1, 17.2, 46.1 |
| Documents | `POST /documents/uploads`, `GET/POST /documents`, `GET/PATCH/DELETE /documents/{id}`, `POST /documents/{id}/versions`, `POST /documents/{id}/versions/{v}/approve`, `POST /documents/{id}/transform` | 19, 32.2 |
| Preferences | `GET/PATCH /tracks`, `GET/PATCH /tracks/{id}`, `POST /tracks/{id}/reset`, `GET/PUT /excluded-countries`, `GET/POST/PATCH/DELETE /compensation-rules`, `GET/POST/PATCH/DELETE /submission-windows`, `GET/POST/PATCH/DELETE /pauses`, `GET/PATCH /notification-settings` | 5.2, 5.3, 6, 47–49, 51 |
| Rules | `GET/POST /auto-rules`, `GET/PATCH /auto-rules/{id}`, `POST /auto-rules/{id}/dry-run`, `POST /auto-rules/{id}/{activate,pause,revoke,renew}` | 10.1, 27.2 |
| Reusable answers | `GET/POST/PATCH/DELETE /reusable-answers`, `GET /question-bank` | 28.3, 37.2 |
| Opportunities | `GET /recommendations` (by track/day), `GET /opportunities/{id}`, `GET /opportunities/{id}/versions`, `GET /opportunities/{id}/versions/{v}/archive`, `POST /opportunities/manual` (link/file/email), `GET /opportunities/search`, `GET /opportunities/why-not?url=`, `POST /opportunities/{id}/decision` (save/dismiss/not eligible), `POST /opportunities/{id}/reports` | 7, 11.1, 27.5, 50 |
| Applications | `POST /applications`, `GET /applications`, `GET /applications/{id}`, `GET /applications/{id}/timeline`, `GET /applications/{id}/qa`, `GET /applications/{id}/files`, `GET /applications/{id}/emails`, `GET /applications/{id}/evidence`, `POST /applications/{id}/{cancel,withdraw,notes,corrections}` | 20, 28 |
| Approvals | `GET /approval-packages?state=ready`, `GET /approval-packages/{id}`, `POST /approval-packages/{id}/{approve,reject,defer}`, `POST /approval-packages/bulk-approve`, `POST /applications/{id}/answers` (blocked questions) | 37 |
| Safety | `POST /emergency-stop`, `DELETE /emergency-stop` | 27.2 |
| Tracking | `GET/POST/PATCH /interviews`, `/assessments`, `/offers`, `/contacts`, `/tasks`; `GET /insights` | 11.5, 20.3, 34 |
| Academic | `GET/POST/PATCH /academic/plans`, `/test-registrations`, `/score-reports`, `/referee-requests`, `/outreach` | 9, 33 |
| Government | `GET /govt/applications/{id}/stages`, `POST /govt/applications/{id}/fee-payments` | 8.4.1, 35.2 |
| Connected accounts | `GET /connections`, `POST /connections/{provider}/authorize`, `DELETE /connections/{id}`, `GET /portal-accounts`, `DELETE /portal-accounts/{id}` | 11.4, 29 |
| Notifications | `GET /notifications`, `POST /notifications/{id}/actions/{action}`, `POST /devices` (push tokens), `POST /channels/whatsapp/verify` | 36 |
| Reports | `GET /reports/daily`, `GET /reports/weekly`, `POST /reports/exports` (PDF/CSV) | 28.4 |
| Metadata | `GET /metadata/opportunity-types`, `GET /metadata/profile-fields`, `GET /metadata/countries`, `GET /metadata/settings-schema` | Extensibility |
| Real-time | `GET /events/stream` (SSE) | — |
| Support | `GET/POST /support/tickets` | 44 |

Inbound webhooks (separate path, signature-verified): `/webhooks/whatsapp`, `/webhooks/gmail`, `/webhooks/graph`, `/webhooks/ses`.

## 4. Admin API resource catalogue (v1)

| Area | Endpoints (main) |
|---|---|
| Dashboard | `GET /dashboard/summary`, `GET /dashboard/{users,recommendations,applications,queue,sources,opportunities,notifications,payments,integrity,support,costs,health}` |
| Users | `GET/POST /users`, `GET/PATCH/DELETE /users/{id}`, `POST /users/{id}/{suspend,reactivate,reset-mfa,sign-out-all,pause,resume,export,delete}`, `GET /users/{id}/view-as/...` (read-only mirror of user endpoints), all user sub-resources |
| Opportunities | `GET/PATCH /opportunities`, `POST /opportunities/{id}/{merge,split,mark-fraud,mark-legit,close}` |
| Sources and plugins | `GET/POST/PATCH/DELETE /sources`, `POST /sources/{id}/run`, `GET /plugins`, `PATCH /plugins/{key}` |
| Applications | `GET /applications`, `GET /applications/{id}`, `POST /applications/{id}/{cancel,verify,correction}` |
| Platform | `GET/PATCH /settings`, `GET/POST/PATCH /feature-flags`, `GET/POST/PATCH /opportunity-types`, `GET/POST/PATCH /scoring-models`, `GET/POST/PATCH /templates`, `GET/PATCH /question-groups`, `POST /emergency-stop` (scoped) |
| Admins | `GET/POST/PATCH/DELETE /admins`, `GET/POST/PATCH/DELETE /roles`, `GET/PUT /roles/{id}/policies` |
| Compliance | `GET /data-requests`, `GET /consents`, `GET/POST /incidents`, `GET /audit-events` (search, export) |
| Support | `GET/PATCH /support/tickets`, `POST /support/tickets/{id}/replies` |
| Reports | `POST /reports/exports` |

Admin endpoints never return secrets; credential endpoints return metadata only and allow revoke/reset/delete (requirements Section 53.5).

## 5. Example: approve with edits

```http
POST /v1/approval-packages/0192f.../approve
Idempotency-Key: 6b1c...
If-Match: "pkg-v4"
Content-Type: application/json

{
  "edits": [
    {"item_id": "q-17", "answer": "Available from 1 December 2026", "scope": "this_application"},
    {"item_id": "q-21", "answer": "Yes", "scope": "reusable_answer"},
    {"item_id": "file-cv", "document_version_id": "0192e...", "scope": "this_application"}
  ],
  "submit_at": {"mode": "window", "window_id": "0192a..."},
  "attestations": [{"item_id": "decl-1", "confirmed": true}]
}
```

```http
202 Accepted
{
  "application_id": "0192f...",
  "submission_status": "approved_queued",
  "scheduled_for": "2026-11-02T18:00:00Z",
  "links": {"self": "/v1/applications/0192f..."}
}
```

## 6. API governance

- Every endpoint has an owner module and appears in the OpenAPI spec with examples.
- CI lints the spec (consistent naming, errors, pagination) and fails on breaking changes inside `/v1`.
- Generated TypeScript clients are rebuilt in CI; the build fails if they are stale.
