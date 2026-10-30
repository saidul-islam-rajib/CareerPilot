# Deployment and remote access — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Production profile: one proxy hop, no static origins, database persistence, sandbox submissions | Unit (Python) | `services/core/tests/unit/platform/test_platform.py` | Passing |
| Web, admin, and extra origins from the environment are validated and added once | Unit (Python) | `services/core/tests/unit/platform/test_platform.py` | Passing |
| Hosted API and admin API addresses override the defaults for web, admin, and mobile builds | Unit (TypeScript) | `packages/client-core/src/config/client-config.spec.ts` | Passing |
| `https://` release builds forbid cleartext; `http://` test builds allow it | Unit (TypeScript) | `packages/client-core/src/config/client-config.spec.ts` | Passing |
| Compose files are valid and require the domain, ACME email, owner email, and secrets | Manual: `docker compose -f docker-compose.prod.yml config` | n/a | See report |
| Caddyfile is valid | Manual: `caddy validate` in the caddy image | n/a | See report |
| Images build (api, web, admin, edge with mobile web export) | Manual: build under project `careerpilot-prodcheck` | n/a | See report |
| Deploy, backup, restore, and health scripts parse | Manual: `bash -n scripts/deploy/*.sh` | n/a | Passing |
| Automatic HTTPS, firewall, backups on a real VM | Not automated in v1; first-deploy checklist in the runbooks | n/a | Owner |
