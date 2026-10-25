# E02 Discovery — Requirements

**Requirement IDs:** §7.1 Sources, §7.2 Search schedule and freshness, §7.3 Evidence, §7.4 Duplicate detection, §7.5 Fraudulent and suspicious postings, §50 Circular archive

## User stories

- As an admin, I want to run a check on a source and see whether it succeeded, was partial, or failed, so that coverage is described honestly.
- As a job seeker, I want the same opening posted on several sources to appear once, with every source link kept.
- As a job seeker, I want suspicious postings labelled with the specific reasons, not hidden.

## Acceptance criteria

- WHEN an admin runs a check on an enabled, configured source THE SYSTEM SHALL fetch it with its connector plugin, record new, updated, and unchanged listings, and update the source's last success, failures, and health.
- WHEN a source has no configured connector THE SYSTEM SHALL refuse the check with `source_not_configured` instead of reporting success.
- WHEN a source cannot be reached or parsed THE SYSTEM SHALL record a failed check, increase the failure count, and mark the source degraded, then failing after the configured number of failures.
- WHEN some items in a feed are incomplete THE SYSTEM SHALL keep the valid ones and record a partial check.
- WHEN a listing's URL or formatting changes but its organization, title, and location do not THE SYSTEM SHALL NOT create a new opportunity; it SHALL add the new source link.
- WHEN a listing's content changes THE SYSTEM SHALL keep every version of the original text (circular archive).
- WHEN a listing contains configured warning signs (upfront fee, guaranteed offer, sensitive data request, personal email contact) THE SYSTEM SHALL flag it with those reasons.
- THE SYSTEM SHALL parse external XML safely (no entity expansion) and never send real requests from tests; local and Docker runs read recorded responses unless `discovery.fetch_mode` is `live`.
