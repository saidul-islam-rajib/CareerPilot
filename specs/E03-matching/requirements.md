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

## One company, three jobs; skills to add (added 2026-10-29)

- At most `matching.max_jobs_per_company` (default 3) open jobs from one company appear across a user's lists, keeping the best
  matches; jobs the user saved or acted on are not counted. Lists already over the limit are trimmed on the next refresh.
- Each job shows up to `matching.skill_gap.limit` (default 3) skills the circular asks for that the profile does not list,
  found with a configured skill vocabulary (`config/defaults/skills.yaml`, longest phrase first, spellings mapped to one name) and
  ranked by mentions (title mentions count more). The user can add a skill they have to their profile or open a learning search;
  CareerPilot never adds a skill on its own.
