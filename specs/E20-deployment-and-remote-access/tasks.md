# Deployment and remote access — Tasks

- [x] Spec (requirements, design, test plan) and Planning/Requirements updates
- [x] Config: `config/env/production.yaml`, `config/defaults/deployment.yaml`, env overrides for web, admin, and CORS addresses (`with_web_address`, `load-config.js`) with unit tests
- [x] `web.Dockerfile` build arguments for environment and API addresses
- [x] `infra/docker/edge.Dockerfile` and `infra/caddy/Caddyfile` (Caddy, HTTPS, mobile web build)
- [x] `docker-compose.prod.yml` and `docker-compose.prod.tools.yml`; `.env.production.example`
- [x] Pass `CAREERPILOT_GOOGLE_CLIENT_ID`, `CAREERPILOT_GOOGLE_CLIENT_SECRET`, `CAREERPILOT_VAULT_KEY` to user-api and workers (dev and prod) and `.env.example`
- [x] `scripts/deploy/` (bootstrap, deploy, deploy-remote, health-check, backup, restore, backup cron)
- [x] `.github/workflows/deploy.yml` (written, never run)
- [x] EAS profiles and `eas env:create` documented; release builds with `https://` forbid cleartext (tested)
- [x] Runbooks `docs/runbooks/deploy-oracle.md` and `deploy-aws.md`; links in QUICKSTART and RUN-LOCALLY
- [x] Local validation: `compose config`, prodcheck image builds, `caddy validate`
- [!] Expo Go from any network: Expo Go loads bundles from a Metro server or from EAS Update. A hosted Metro is not suitable and a laptop tunnel is forbidden. Option A (recommendation): add `expo-updates`, run `eas update:configure`, publish with `eas update --channel preview`, and open the update link in Expo Go; this changes `package.json`, the lockfile, and native builds, so it needs the owner's go-ahead. Option B: use only the installed APK and the iPhone home-screen app (both work). Expo Go on the same Wi-Fi with `CAREERPILOT_API_URL=https://api.<domain> pnpm phone` also works.
- [!] First real deploy: needs the owner's VM, domain, DNS records, and secrets (production checkpoint, `Planning/10-AIDLC-Agents.md` §4). The deploy workflow was written but never run.
- [!] linux/arm64 image builds were not run on an ARM machine here; the VM builds natively, so the first deploy on Ampere A1 or Graviton is the proof. Recommendation: watch the first `deploy.sh` run.
