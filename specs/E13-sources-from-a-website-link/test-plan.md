# E13 Sources from a website link — Test plan (unit only)

- Readers: Lever, Ashby, Workable, SmartRecruiters, easy.jobs (with details) and HTML (JSON-LD postings; job links enriched from detail pages) turn their responses into listings; non-JSON board responses fail with `invalid_board`.
- JSON reader: picks the job list, finds nested apply links, reads loose dates, skips records without a link.
- Resolver: links get `https`; a career page that loads jobs with scripts uses the job API named in its own script; a job board link reads the board API without crawling; a site linking to a board uses it; career pages are followed to job links; a job feed is used directly; a site without jobs gives nothing within the page budget and never fetches a page twice.
- Admin: a website link alone finds the board, names the source, and brings its jobs in; a site without jobs is refused with `jobs_not_found` and nothing is saved; a source saved with the wrong reader heals on its next check; a failed check shows the last problem and time.
- Admin app: the add form sends only the link (and optional name); "More options" sends the reader and defaults; the list shows the last problem.
