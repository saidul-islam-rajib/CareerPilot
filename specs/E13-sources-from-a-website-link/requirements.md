# E13 Sources from a website link — Requirements

**Requirement IDs:** §53.2–53.3 admin catalog (sources), discovery (E02), Product Owner decision 2026-10-28 ("admin will give only website link when adding source and the system auto find jobs available")

## Root cause of the reported failure

Sources added as a company home page (`https://brainstation-23.com/`, `https://www.optimizely.com/`) were saved with the `rss` reader. A home page is HTML, not a feed, so every check failed with `invalid_feed` and no jobs were found. The admin had to know the right reader and the right feed address, which a person adding a company site does not know.

## User stories

- As an admin, I paste only a company's website (or its careers page, or its job board link) and the system finds where its jobs are listed and starts bringing them in.
- As an admin, I see why a source is not bringing jobs in.
- As a job seeker, jobs from company sites reach my lists without anyone choosing a technical reader.

## Acceptance criteria

- WHEN an admin adds a source with only a website link THE SYSTEM SHALL treat a link without a scheme or with `http` as `https`, check the address is public, and find the jobs: a known job board link (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, easy.jobs) is read through its public board API; otherwise the site is visited (within a page budget from config) following career and job links and common career paths, and the first job board, job feed, or page with structured job postings is used; failing that, the page listing the most job links.
- WHEN nothing with at least one job is found THE SYSTEM SHALL refuse with `jobs_not_found` and save nothing.
- WHEN the name is left empty THE SYSTEM SHALL use the organization name found on the board or site.
- WHEN a check fails or finds no jobs and the source's site can be read another way THE SYSTEM SHALL switch the source to that reader and check again (existing sources saved with the wrong reader heal on their next check).
- Each source row SHALL show when it was last checked and the last problem (cleared after a check that finds jobs); a check that finds no jobs marks the source degraded.
- Admins MAY still choose a reader and listing defaults under "More options".
- Every fetch keeps the E12 address safety and an honest user agent; no CAPTCHA solving or bot evasion; pages needing sign-in are not read.
