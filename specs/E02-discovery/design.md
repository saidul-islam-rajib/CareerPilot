# E02 Discovery — Design

## Modules

- `careerpilot.discovery` (bounded context): `SourceConnector` plugin port (key, version, interface version, `parse`), `Fetcher` port (`FixtureFetcher` for recorded responses, `HttpFetcher` for live), `ListingCatalog` port (in-memory and SQL).
- First-party connectors: `rss` (RSS 2.0 and Atom; "Organization: Title" headings) and `greenhouse` (public job board JSON).
- `ConnectorRegistry` rejects plugins with an incompatible interface version.
- `DiscoveryService.run(source_id)` → `SourceCheck` (outcome, found, new/updated/unchanged listings).
- Dedup: canonical URL first, then fingerprint of normalized organization, title, and location. Content hash decides updated vs unchanged.
- `WarningSignScreen`: phrase lists and free-mail domains from `config/defaults/discovery.yaml`.
- Administration: `run_source_check` calls discovery and applies the result (`administration/discovery_sync.py`); new listings appear in Admin → Opportunities.

## API

No new endpoints. `POST /admin/v1/sources/{id}/check` now runs a real check; `409 source_not_configured` for sources without a connector.

## Data

- `discovered_listings` (id, fingerprint, status, JSON document with sources and archived versions) and `discovered_listing_urls` (canonical URL → listing), both with audit and soft-delete columns. Migration `5b983c18e6b1`.
- On startup, if the catalog is empty, every enabled configured source is checked once (`discover_when_empty`). Since E11 no source is configured by default; the recorded responses live in `services/core/tests/fixtures/discovery/` for tests.

## Configuration

`discovery.fetch_mode` (`fixture` | `live`), `fixture_root`, `user_agent`, `timeout_seconds`, `max_listings_per_check`, `failing_after_failures`, `sources.{id}` (connector, url, fixture, defaults), `warning_signs`.

## Edge cases

- Missing publication date or deadline stays empty; never inferred.
- Distinct openings with the same organization and title but different locations stay separate.
- Feeds with entity declarations are rejected as invalid.
