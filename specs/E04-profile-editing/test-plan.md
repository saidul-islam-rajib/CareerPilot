# E04 Profile editing — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Basics, contacts, skills, sections validation and soft delete | Unit | `services/core/tests/unit/candidate/test_profile_editing.py` | Passing |
| Uploads (PDF/photo checks, versions, signed links) | Unit | `services/core/tests/unit/candidate/test_profile_files.py` | Passing |
| HTTP endpoints including multipart | Unit (TestClient) | `services/core/tests/unit/api/test_profile_api.py` | Passing |
| Client validation of section fields | Unit | `packages/validation/src/*.spec.ts` | Passing |
| In-memory and HTTP adapters | Unit | `packages/api-client/src/**/*.spec.ts` | Passing |
| Web editor flows | Unit (Testing Library) | `apps/web/src/features/profile/*.spec.tsx` | Passing |
| Mobile editor flows | Unit (Testing Library) | `apps/mobile/src/features/profile/*.spec.tsx` | Passing |
