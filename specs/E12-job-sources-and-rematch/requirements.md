# E12 Job sources and rematching — Requirements

**Requirement IDs:** §53.2–53.3 admin catalog (sources), discovery and matching (E02, E03), Product Owner decisions 2026-10-27 (admins add sources; rescore and refill on change)

## User stories

- As an admin, I add a job source (an RSS feed or a Greenhouse company board) from the admin app, or pick one from a list of suggested real sources with one click, so jobs flow in only from sources I choose.
- As a job seeker, when I update my profile or my tracks, my job lists are scored again and show the best matches first.

## Acceptance criteria

- WHEN a Super Admin (or a role allowed to create sources) adds a source with a name, a connector (`rss` or `greenhouse`), an `https` address, and listing defaults THE SYSTEM SHALL save it, check it once at once, and include it in scheduled checks.
- WHEN the address is not `https`, points at a private, loopback, or link-local host, or the connector is unknown THE SYSTEM SHALL refuse it with a validation error and fetch nothing.
- WHEN an admin opens the add form THE SYSTEM SHALL list the suggested sources from config that are not added yet.
- WHEN a user changes their profile or a track THE SYSTEM SHALL score every eligible listing again, keep the jobs the user approved, applied to, or decided on, and refill each track with the best remaining matches (at least the minimum score), best first.
- Lists of jobs SHALL be ordered by match score, highest first.
