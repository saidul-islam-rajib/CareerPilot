# E03 Matching and recommendations — Requirements

**Requirement IDs:** §5 Tracks, §7.3 Evidence, §10 Matching and scoring, §38 Precedence (hard filters before scores)

## User stories

- As a job seeker, I want discovered opportunities ranked for each of my tracks, with readable reasons, so I can decide quickly.
- As a job seeker, I want opportunities that clearly fail a mandatory requirement (for example no visa sponsorship on my sponsored-jobs track) marked as a hard failure.

## Acceptance criteria

- WHEN new listings are discovered or the service starts THE SYSTEM SHALL assess every eligible, not-yet-assessed listing for each active user's tracks and add those at or above the minimum score, up to the track's result count.
- THE SYSTEM SHALL only consider listings that fit the track's rules (work arrangement, country, opportunity type) and SHALL exclude flagged listings unless configured otherwise.
- THE SYSTEM SHALL show each user their own score, reasons, and requirement checks on the shared opportunity.
- WHEN a posting states that visa sponsorship is not available on a sponsorship track THE SYSTEM SHALL mark the sponsorship requirement as not met and the match as a hard failure.
- THE SYSTEM SHALL never invent facts: missing information is "unknown".
- WHEN Claude is configured (`matching.mode: claude` and `ANTHROPIC_API_KEY`) THE SYSTEM SHALL use it for assessment and fall back to the rule-based matcher on refusal, rate limit, API error, or network error. Tests never call the real API.
