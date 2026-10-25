# E03 Matching and recommendations — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Ranking with reasons | Unit | `services/core/tests/unit/matching/test_matching.py::test_rules_reward_similar_titles_and_profile_skills` | Passing |
| Sponsorship hard failure | Unit | `test_matching.py::test_rules_mark_unavailable_sponsorship_as_hard_failure` | Passing |
| Track eligibility and flagged exclusion | Unit | `test_matching.py::test_tracks_only_take_eligible_listings` | Passing |
| Claude structured assessment | Unit (fake client) | `test_matching.py::test_claude_matcher_maps_structured_assessment` | Passing |
| Fallback on refusal and errors | Unit (fake client) | `test_matching.py::test_claude_matcher_falls_back_on_refusal_and_errors` | Passing |
| Recommendations per user, idempotent refresh | Unit | `test_matching.py::test_discovered_listings_become_personal_recommendations` | Passing |
