# E12 Job sources and rematching — Design

## Rematching

- `RecommendationService.rematch(user_id)`: for each track (by position), keep the opportunities the user acted on (a decision, an approval, or an application), score every other eligible listing again with the configured matcher, and fill the track with the best ones at or above `matching.min_score` up to the track's result count. A listing is placed in one track only. After `refresh` and `rematch`, every listed job in an automatic track that the user has not acted on and that has no hard failure is applied by rule (`automatic_candidates`), so switching a track to automatic also covers the jobs already listed (root cause of the 2026-10-28 report that nothing was applied automatically: only newly placed jobs were applied, and full lists placed nothing new).
- The email route is chosen only when the posting asks for applications at that address: an email counts when one of `matching.application_email.phrases` appears within `window_chars` before it and its local part has none of `excluded_words` (accommodation, privacy, and similar contacts are never used to apply). Other jobs use `matching.default_route` (portal), which needs the user to submit on the employer's site.
- `ProfileService` and `PreferencesService.update_track` call it after saving (an injected `on_change` callback), so the response already reflects the new lists.
- Scores shown to the user come from `workspace.matches`; the dashboard sorts each track by score, highest first.
- Cost: with `matching.mode: claude` every rematch asks the model once per eligible listing; a per-profile cache is a follow-up before turning that mode on with a key.

## Admin-managed sources

- `discovery.sources` (config) stays for tests; sources added by admins live in the admin directory: `AdminSourceRow` gains an optional `definition` (connector, url, listing defaults). `DiscoveryService` reads definitions from config plus the directory, so `is_configured`, `run`, and scheduled checks cover both.
- `POST /admin/v1/sources` (`{name, connector, url, defaults}`) → the new source row after its first check; `GET /admin/v1/sources/suggestions` → suggested sources from `discovery.suggested_sources` in config not added yet (matched by address).
- Address safety (OWASP ASVS L2, SSRF): scheme `https`, a host name (no credentials), and every resolved address public (`ipaddress` `is_global`); checked when the source is added and again before each live fetch.
- Admin app: the Sources page gets an **Add source** form and the suggestions list with an **Add** button each; text from the catalog.
