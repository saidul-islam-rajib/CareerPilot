# E12 Job sources and rematching — Design

## Rematching

- `RecommendationService.rematch(user_id)`: for each track (by position), keep the opportunities the user acted on (a decision, an approval, or an application), score every other eligible listing again with the configured matcher, and fill the track with the best ones at or above `matching.min_score` up to the track's result count. A listing is placed in one track only. Newly placed listings in an automatic track are applied by rule, as in `refresh`.
- `ProfileService` and `PreferencesService.update_track` call it after saving (an injected `on_change` callback), so the response already reflects the new lists.
- Scores shown to the user come from `workspace.matches`; the dashboard sorts each track by score, highest first.
- Cost: with `matching.mode: claude` every rematch asks the model once per eligible listing; a per-profile cache is a follow-up before turning that mode on with a key.

## Admin-managed sources

- `discovery.sources` (config) stays for tests; sources added by admins live in the admin directory: `AdminSourceRow` gains an optional `definition` (connector, url, listing defaults). `DiscoveryService` reads definitions from config plus the directory, so `is_configured`, `run`, and scheduled checks cover both.
- `POST /admin/v1/sources` (`{name, connector, url, defaults}`) → the new source row after its first check; `GET /admin/v1/sources/suggestions` → suggested sources from `discovery.suggested_sources` in config not added yet (matched by address).
- Address safety (OWASP ASVS L2, SSRF): scheme `https`, a host name (no credentials), and every resolved address public (`ipaddress` `is_global`); checked when the source is added and again before each live fetch.
- Admin app: the Sources page gets an **Add source** form and the suggestions list with an **Add** button each; text from the catalog.
