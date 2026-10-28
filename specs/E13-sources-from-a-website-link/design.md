# E13 Sources from a website link — Design

## Readers (connectors)

| Key | Reads | Organization |
|---|---|---|
| `rss` | RSS or Atom feed | defaults, or "Company: Title" |
| `greenhouse` | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | defaults |
| `lever` | `api.lever.co/v0/postings/{token}?mode=json` | defaults |
| `ashby` | `api.ashbyhq.com/posting-api/job-board/{token}` | defaults |
| `workable` | `apply.workable.com/api/v1/widget/accounts/{token}?details=true` | account name |
| `smartrecruiters` | `api.smartrecruiters.com/v1/companies/{token}/postings` | company name |
| `easyjobs` | `{token}.easy.jobs/api/career/home` (+ job detail API for descriptions) | company name |
| `json` | a site's own job API (found in its career page scripts): the largest list of records with a title and a link, fields named in `discovery.json_fields`, dates in `discovery.date_formats` | site name |
| `html` | any page: schema.org `JobPosting` JSON-LD first, else links that look like job pages; the first `discovery.max_detail_pages` links are opened for their JSON-LD details | site name |

Board link patterns and API addresses live in `discovery.job_boards` (config), so a new board is a config change plus a reader. Trakstar Hire / Recruiterbox (`{client}.recruiterbox.com`, `{client}.hire.trakstar.com` → `jsapi.recruiterbox.com/v1/openings?client_name={client}`) and Pinpoint (`{company}.pinpointhq.com/postings.json`) use the `json` reader. Career sites on their own domain that are powered by a platform are found by a marker in the page (`discovery.job_platforms`, e.g. `pinpointhq.com` → `{site}/postings.json`).

A job board, platform API, or job feed that answers correctly but has no openings today is kept as a fallback and accepted when nothing with jobs is found (the source shows "No open jobs right now" and is checked on schedule). Script-found APIs and HTML pages still need at least one job.

## Resolver

`discovery/resolver.py` `SourceResolver(fetch_page, registry, config).resolve(link) -> ResolvedSource | None`:

1. Normalize to `https`. If the link itself matches a job board pattern, read that board.
2. Otherwise crawl breadth-first within `discovery.max_resolve_pages`: career-looking links on the same site first (`max_career_links` per page, job pages excluded), then `discovery.job_page_paths` once per host.
3. On each page: a feed body → `rss`; any job board link in the page → that board; a `<link rel=alternate>` job feed → `rss`; JSON-LD job postings → `html`; at least `min_job_links` job links → an `html` candidate (stop when one reaches `enough_job_links`).
4. A career page (career words in its title or path) that shows nothing else: up to `discovery.max_script_scans` of its own scripts (career-named first) are read for quoted same-site `/api/` or `.json` addresses with job words, and each is tried with the `json` reader (US-Bangla Airlines loads its jobs this way).
5. A candidate counts only if its reader parses at least one listing.

`HttpFetcher.fetch_url(url) -> (final_url, body)` is the guarded page fetcher (SSRF hook on every request and redirect). Fetch errors are reduced to `http_status`, `unreachable`, `unsafe_address`.

## Admin

- `NewSource {url, name?, connector?, defaults?}`; `SourceSetup` gains `siteUrl`; `AdminSourceRow` gains `lastCheckedAt`, `lastError`.
- `add_source`: empty connector → `SourcePolicy.resolved_setup(site_url, defaults)`; organization default filled from what was found; duplicates refused by site or board address.
- `SourceCheckRunner(heal=SourcePolicy.healed)`: when a check fails or finds nothing, resolve `siteUrl` (or the stored address) again; if that gives a different reader or address, save it and check again.
- Admin app: the add form asks for the website link (name optional) with reader and defaults under "More options"; the sources list shows the last problem.
