# E03 Matching and recommendations — Design

## Modules

- `careerpilot.matching.ports.Matcher` → `assess(profile, track, listing) -> OpportunityMatch`.
- `RuleBasedMatcher` (deterministic): base + title similarity to experience + profile skills mentioned + track arrangement fit; sponsorship check from configured phrases. Reasons come from the `matching.*` string catalog.
- `ClaudeMatcher`: `client.messages.parse(model=matching.model, output_config={effort}, output_format=Assessment)` with the versioned prompt `config/prompts/match-v1.md`; falls back to the rules on refusal or API/network errors.
- `RecommendationService.refresh(user)` / `refresh_all()`: eligible listings per track (`matching.track_rules`), skip already-assessed ones, store every assessment in `workspace.matches`, publish qualified listings as `OpportunityDetail` (source, archived circular, sponsorship evidence, default route) and append them to the track.
- `OpportunityService` overlays the user's match (score, factors, requirements, hard failure) on the shared opportunity.
- Triggers: container start (idempotent) and every admin source check that finds new listings.

## Data

`CandidateWorkspace.matches` (JSON in the workspace document). No new tables.

## Configuration

`config/defaults/matching.yaml`: mode, model (`claude-opus-5-5`), effort, max_tokens, api_key_env, prompt_file, rules_version, min_score, include_flagged, default_route, weights, track_rules, sponsorship phrases. Docker sets `mode: claude`; without a key the rules are used.
