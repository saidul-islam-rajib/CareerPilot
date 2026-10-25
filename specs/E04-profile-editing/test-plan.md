# E04 Profile editing — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Basics, contacts, skills, sections validation and soft delete | Unit | `services/core/tests/unit/candidate/test_profile_editing.py` | Planned |
| Uploads (PDF/photo checks, versions, signed links) | Unit | `services/core/tests/unit/candidate/test_profile_files.py` | Planned |
| HTTP endpoints including multipart | Unit (TestClient) | `services/core/tests/unit/api/test_profile_api.py` | Planned |
| Client validation of section fields | Unit | `packages/validation/src/*.spec.ts` | Planned |
| In-memory and HTTP adapters | Unit | `packages/api-client/src/**/*.spec.ts` | Planned |
| Web editor flows | Unit (Testing Library) | `apps/web/src/features/profile/*.spec.tsx` | Planned |
| Mobile editor flows | Unit (Testing Library) | `apps/mobile/src/features/profile/*.spec.tsx` | Planned |
