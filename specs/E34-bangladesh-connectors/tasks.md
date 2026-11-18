# E34 Bangladesh connectors (REMAINING rows E02, E03)

Checked 2026-11-19 with the CareerPilotBot user agent; read-only, no forms, no login.

## Site decisions
- bdjobs.com: SKIP. Listings load through private app APIs behind the logged-in app, robots.txt disallows data paths, terms are not machine-readable; already in `discovery.ignored_hosts`.
- skill.jobs: SKIP. Next.js client rendering, no feed or sitemap, terms page not found, so permission to read automatically cannot be confirmed.
- chakri.com: SKIP. Origin unreachable (HTTP 523) at check time; revisit when it responds.
- BD government notice pages (bpsc.gov.bd, dpe.gov.bd, mopa.gov.bd, teletalk): BUILD. Public HTML notice lists; no robots.txt (404) so default allow; one `bd_notice` connector, hosts and keywords from config.
- Universities: BUILD only via existing `rss` and `html` connectors; no verified public program feeds, so no suggested sources added (admin adds a URL per university).

## Tasks
- [x] Spec and site checks
- [x] `bd_notice` connector: notice and circular anchors (English and Bangla keywords), PDF links, deadline from title, config in `discovery.bangladesh`
- [x] PDF text extraction (`pypdf`, BSD, pure Python, in pyproject), Bangla digits normalised
- [x] `RequirementExtractor` port with rule extractor (age, education, experience, deadline, fee, posts); AI upgrade slot later, never invents facts
- [x] Fixtures under tests/fixtures/bangladesh, unit tests
- [ ] Live Anthropic extractor (needs ANTHROPIC_API_KEY, ACCOUNT)
