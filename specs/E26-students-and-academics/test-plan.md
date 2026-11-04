# E26 Students and academics — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Programs, evidence labels, from opportunity, scholarship links | unit | services/core/tests/unit/academic/test_programs.py | Done |
| Test expiry warnings, score reports, credentials in original scale | unit | services/core/tests/unit/academic/test_tests_and_credentials.py | Done |
| Referee consent and recommendation evidence | unit | services/core/tests/unit/academic/test_referees.py | Done |
| Outreach drafting, limits, decline, replies | unit | services/core/tests/unit/academic/test_outreach.py | Done |
| Portal blockers, decisions, user-only actions, comparison, checklist, plan and budget | unit | services/core/tests/unit/academic/test_journey.py | Done |
| Audit columns and soft delete | unit | services/core/tests/unit/academic/test_persistence.py | Done |
| API client and hooks | unit | packages/api-client/src/academic/academic.spec.ts, packages/client-core/src/hooks/use-academic.spec.ts | Done |
| Web and mobile screens | unit | apps/web/src/features/academic/*.spec.tsx, apps/mobile/src/features/academic/*.spec.tsx | Done |
