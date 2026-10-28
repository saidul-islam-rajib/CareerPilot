# E14 Job sources added by users — Requirements

**Requirement IDs:** §7.1.1 (sources added by a link), §53.4 (admin sources), Product Owner request 2026-10-28 ("user should have the same functionality to add source ... in the admin side, it will be pending for approval ... be aware of duplications")

## User stories

- As a job seeker, I paste a company's website and its jobs start reaching my matches, with applications prepared like any other job.
- As a job seeker, I see my sources, whether an admin shared them with everyone, why not, and I can stop using one.
- As an admin, I see sources users added, who added them and why, and I approve them for everyone or keep them private, with a justification.

## Acceptance criteria

- WHEN a user adds a link THE SYSTEM SHALL find the jobs the same way as for admins (E13), save the source as **pending** with the user as an owner, check it once, and refresh that user's matches. WHEN no jobs are found THE SYSTEM SHALL refuse with `jobs_not_found` and save nothing.
- WHILE a source is pending or kept private THE SYSTEM SHALL show its jobs only to its owners. WHEN an admin approves it THE SYSTEM SHALL show its jobs to everyone and refresh every user's matches.
- An admin decision SHALL require a justification (validation `note` length), be recorded in the audit log, and be shown to the owners. An approved source cannot be reviewed again (`source_reviewed`).
- Duplicates: a link matching an existing source (scheme, `www.`, trailing slash ignored; or the same job board found) SHALL join it instead of creating another. A user's own duplicate → `source_exists`; a source shared with everyone → `source_shared`; an admin adding a site a user requested → `source_pending`.
- A user SHALL have at most the platform limit of sources (`source_limit`): a Super Admin sets it in Platform settings (`maxSourcesPerUser`, from `job_sources.min_limit` to `job_sources.max_limit`); until set it is `job_sources.max_per_user` (10). Removing one takes the user off it; when nobody uses a private source it stops being checked; adding it again brings it back.
- User actions on sources are recorded in the audit log as the user.
