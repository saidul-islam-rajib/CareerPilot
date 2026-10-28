# E14 Job sources added by users — Design

## Data

One source directory for everyone. `AdminSourceRow` gains `review` (`SourceReview`: approved, pending, rejected; admin-added sources are approved), `ownerIds` (users who added it), `requestedAt`, `requestNote`, `reviewedAt`, `reviewNote`. Rows are JSON projections, so no migration.

## Visibility

`listing_visibility(sources)` → per user: a listing is visible if any of its sources is approved or owned by the user (sources only in config count as shared). `RecommendationContext.listings(user_id)` uses it, so refresh and rematch only place jobs the user may see. Applications, answers, and submissions are unchanged.

## Services and API

- `UserSourceService` (`administration/user_sources.py`): `mine`, `add` (normalize → address check → duplicate lookup by site → resolve (E13) → duplicate lookup by board → create pending + check + rematch the user so the best jobs, including the new ones, fill their lists), `remove`. Joining keeps one row; reviving a row nobody used re-enables and checks it.
- `AdminCatalogService.source_requests`, `review_source(SourceDecision{review, note})` (calls `recommendations.refresh_all` on approval); admin add refuses `source_pending`.
- User API: `GET/POST /v1/sources`, `DELETE /v1/sources/{id}`. Admin API: `GET /admin/v1/sources/requests`, `POST /admin/v1/sources/{id}/review`.
- Config: `job_sources.max_per_user` (shipped to clients as `jobSources`), `validation.note.max_length`; enum `source_review` in `enum-values.yaml`.

## Apps

- Web `/settings/sources`, mobile `settings/sources` + `settings/source`: list with review and health badges, jobs found, last check, admin reason, last problem; add (link, optional name, optional reason); remove with confirmation. Shared hook `useJobSources` / `useAddJobSourceForm` / `useRemoveJobSource` in client-core.
- Admin Sources page: "Waiting for review" card (who, when, why, jobs found) with Approve / Keep private dialogs that require a justification; list rows show "Users only" for private sources.
