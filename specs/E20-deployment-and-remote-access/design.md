# Deployment and remote access — Design

## Shape

One VM runs Docker Compose (`docker-compose.prod.yml`, project `careerpilot-prod`). Images are built on the VM, so the architecture (Ampere A1 ARM64, Graviton, or x86) is the VM's own. All base images are multi-architecture (python, node, caddy, postgres, redis, temporal, grafana otel-lgtm, mailpit), and every Python and Node dependency ships `linux/arm64` and `linux/amd64` wheels or is pure code.

| Name | Serves | Target |
|---|---|---|
| `app.<domain>` | User web app | `web:3000` |
| `admin.<domain>` | Admin web app | `admin:3001` |
| `api.<domain>` | User API (and the Google OAuth callback) | `user-api:8000` |
| `admin-api.<domain>` | Admin API | `admin-api:8001` |
| `m.<domain>` | Mobile app web build (iPhone home-screen app) | static files inside the Caddy image |

Caddy (`infra/caddy/Caddyfile`, image `infra/docker/edge.Dockerfile`) terminates HTTPS with Let's Encrypt (HTTP-01), redirects HTTP to HTTPS, adds HSTS and nosniff, hides `/docs`, `/redoc`, and `/openapi.json` on the API hosts, and limits request bodies. Certificates live in the `caddy-data` volume. `CAREERPILOT_ACME_CA` can point to the Let's Encrypt staging CA while testing.

The edge image has two stages: a Node stage runs `expo export --platform web --clear` with `CAREERPILOT_API_URL=https://api.<domain>` baked in, then the Caddy stage copies `dist` to `/srv/mobile` (single-page fallback to `index.html`, immutable caching for hashed assets).

## Networks and volumes

- `edge`: Caddy, web, admin, user-api, admin-api.
- `backend`: postgres, redis-cache, redis-coord, mailpit (sandbox sink), temporal, temporal-ui (profile `tools`), lgtm (Grafana, Loki, Tempo, Prometheus), migrate, workers, and both APIs.
- Only Caddy publishes ports (`CAREERPILOT_HTTP_PORT` / `CAREERPILOT_HTTPS_PORT`, default 80/443; other values exist only for local checks).
- Named volumes: `postgres-data`, `redis-coord-data`, `profile-files`, `lgtm-data`, `caddy-data`, `caddy-config`.
- Every service has `restart: unless-stopped` (migrate: `no`), JSON log rotation, and a healthcheck (Postgres `pg_isready`, Redis `ping`, APIs HTTP/TCP probe, Next.js HTTP probe, Temporal `tctl cluster health`, Grafana health, Caddy admin endpoint).
- `docker-compose.prod.tools.yml` is an opt-in override (`CAREERPILOT_TOOLS=1`) that publishes Grafana, Temporal UI, and Mailpit on `127.0.0.1` of the VM only, for use through an SSH tunnel.

## Configuration

- `config/env/production.yaml` sets the production profile. Values that depend on the domain come from the environment because the domain is not known at commit time:
  - `CAREERPILOT_WEB_BASE_URL`, `CAREERPILOT_ADMIN_WEB_BASE_URL` (email link bases) and `CAREERPILOT_CORS_ORIGINS` (extra origins, comma separated) are read by `with_web_address` in `platform/config.py`; each is validated as an http(s) origin and added to the CORS allow-list once.
  - `CAREERPILOT_API_URL` / `CAREERPILOT_ADMIN_API_URL` (names in `config/defaults/deployment.yaml`) are baked into the web, admin, and mobile builds by `scripts/config/load-config.js`.
  - `CAREERPILOT_API_PUBLIC_URL` is the base of the Google OAuth redirect (`/v1/integrations/google/callback`).
- Compose derives all of these from `CAREERPILOT_DOMAIN`, so the owner sets one domain.
- Submission delivery stays in `sandbox` mode (Mailpit, internal): real application email is a PO checkpoint (`Planning/10-AIDLC-Agents.md` §4). Account email (registration and reset links) goes through the real mail service when `CAREERPILOT_MAIL_USER` and `CAREERPILOT_MAIL_PASSWORD` are set.
- `trusted_proxy_hops: 1` makes the sign-in guard and activity log use the client IP that Caddy appends to `X-Forwarded-For`.
- Secrets (`CAREERPILOT_TOKEN_SECRET`, passwords, `ANTHROPIC_API_KEY`, mail password, Google client secret, `CAREERPILOT_VAULT_KEY`) exist only in the server's `.env`; Compose refuses to start when required ones are missing.

## Scripts (`scripts/deploy/`)

| Script | Runs where | Purpose |
|---|---|---|
| `bootstrap-vm.sh` | VM, as root, once | Docker Engine + compose plugin, ufw (22/80/443), Oracle iptables, swap, unattended upgrades, `deploy` user, SSH hardening |
| `deploy.sh` | VM, as deploy | `git pull --ff-only` (or `--ref <tag>`), `compose build --pull`, migrate, `up -d`, health check |
| `deploy-remote.sh` | Laptop | Runs `deploy.sh` on the VM over SSH |
| `health-check.sh` | VM | Container health and HTTPS answers for the five sites |
| `backup.sh` / `install-backup-cron.sh` | VM | Nightly `pg_dump` (custom format) and files archive, retention by age, cron entry |
| `restore.sh` | VM | Stop apps, `pg_restore --clean`, restore files, migrate, start, health check |

`.github/workflows/deploy.yml` (manual dispatch and `v*` tags) runs `deploy.sh` over SSH with repository secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_PATH`, in the protected `production` environment.

## Mobile

- `eas.json` profiles read `CAREERPILOT_API_URL` and `APP_ENV` from the EAS environment (`preview`, `production`). `app.config.ts` turns on Android cleartext and the iOS ATS exception only when the address starts with `http://`, so an `https://` release stays locked down (unit-tested).
- The installed APK and the iPhone home-screen app (`https://m.<domain>`) talk to `https://api.<domain>`. Expo Go cannot load a laptop-free bundle without EAS Update (see tasks).

## Edge cases

- Cloudflare proxy (orange cloud) works only after the first certificate is issued with DNS-only, and needs SSL mode Full (strict); the runbooks recommend DNS-only.
- Oracle images ship iptables rules that reject new ports; `bootstrap-vm.sh` opens 80/443 there.
- Temporal keeps its state in the same Postgres server, in separate databases; `backup.sh` dumps the application database only (workers recreate schedules on start).
- Caddy waits for healthy web, admin, and API containers, so a broken release never serves half a site; the previous containers keep running until `up -d` replaces them.
