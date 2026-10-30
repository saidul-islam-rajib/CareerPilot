# Deployment and remote access — Requirements

**Requirement IDs:** REQ-24.5 (hosting and remote access), REQ-24.1 (operational health), REQ-53.1 (separate admin application)

## User stories

- As the owner, I want to deploy the whole product to one cloud VM (Oracle Cloud Always Free or AWS) with a few commands so that the product runs without my laptop.
- As a job seeker, I want the phone app (installed Android app, iPhone home-screen app, Expo Go) to work from any network over HTTPS so that I can use it away from home.
- As the owner, I want automatic HTTPS, nightly backups, and one-command updates so that running the server stays simple and safe.
- As the owner, I want my laptop never exposed to the internet so that development stays private.

## Acceptance criteria

- WHEN the owner sets `CAREERPILOT_DOMAIN` and DNS A records for `app`, `admin`, `api`, `admin-api`, and `m` point to the VM THE SYSTEM SHALL serve each at `https://<name>.<domain>` with a Let's Encrypt certificate that renews automatically.
- THE SYSTEM SHALL publish only ports 80 and 443 on the VM; databases, Redis, Temporal, the mail sandbox, and observability stay on internal networks.
- THE SYSTEM SHALL build and run on `linux/amd64` and `linux/arm64` from the same files.
- WHEN a service stops unexpectedly THE SYSTEM SHALL restart it, and `scripts/deploy/health-check.sh` SHALL report which service is unhealthy.
- WHEN the owner runs the update script THE SYSTEM SHALL pull the code, rebuild images, run database migrations, restart changed services, and report health.
- WHEN the nightly backup runs THE SYSTEM SHALL save a database dump and an archive of uploaded files, and delete backups older than the retention period (default 14 days).
- WHEN the owner runs the restore script with a backup THE SYSTEM SHALL replace the database and files with that backup only after an explicit confirmation flag.
- WHEN `APP_ENV=production` THE SYSTEM SHALL load `config/env/production.yaml`: no cleartext origins, `api.allow_server_change` off, one trusted proxy hop, real account email only when mail credentials are set, application submissions still in the sandbox.
- WHEN a release build of the phone app has an `https://` API address THE SYSTEM SHALL disallow cleartext traffic; only builds with an `http://` test address keep the existing allowance.
- THE SYSTEM SHALL read the hosted API address for phone builds from the EAS environment variable `CAREERPILOT_API_URL`.
- THE SYSTEM SHALL never open a tunnel to, or expose, a developer laptop.
- THE SYSTEM SHALL keep every secret out of git; `.env.production.example` lists every variable without values.
