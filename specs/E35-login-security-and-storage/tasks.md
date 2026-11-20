# E35 Login security and storage

Source: specs/REMAINING.md (BFF, admin MFA, S3 storage). Requirements: REQ-13, REQ-41, REQ-53.2; Planning/Design/12-Security-Architecture.md.

## Decisions
- [!] MFA: plan names Keycloak (realms, TOTP). Option A Keycloak: extra container, realm config, OIDC wiring, no v1 gain beyond TOTP. Option B in-app RFC 6238 TOTP with recovery codes. Chosen B; Keycloak can replace it later.
- BFF: Next route handlers proxy `/api/bff/<upstream>/...`; token lives only in an httpOnly cookie; CSRF by Origin check plus double-submit header; mobile keeps bearer tokens.
- Re-authentication: short-lived proof token from password plus TOTP, sent as `X-Reauth-Token` on destructive admin actions.
- User TOTP: not required by the requirements; not built.

## Tasks
- [x] E35-1 Spec and decisions
- [x] E35-2 packages/bff: proxy handler, cookie and CSRF rules, unit tests; config `bff` section
- [x] E35-3 Web and admin route handlers; client uses `/api/bff`, no token in JS or storage
- [x] E35-4 Backend TOTP: secret (vault-encrypted), recovery codes, enrolment, sign-in code, migration, tests
- [x] E35-5 Re-authentication proof on suspend, delete, role change, platform stop; tests
- [x] E35-6 Admin app: enrolment screen, code field on sign-in, re-auth dialog; tests
- [x] E35-7 Storage port: S3-compatible adapter chosen by `storage.backend`, signed links, tests
- [x] E35-8 MinIO in docker-compose.prod.yml; env names in .env.production.example
