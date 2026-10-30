# Quick start

Run every command in **PowerShell or Git Bash, in the project folder** (`Desktop\CareerPilot`), unless a step says otherwise. Full guide: [RUN-LOCALLY.md](RUN-LOCALLY.md).

## 1. One time only

Needs Docker Desktop (running), Node.js 24 and pnpm.

```bash
cp .env.example .env        # then put your email in CAREERPILOT_OWNER_EMAIL
pnpm install
```

## 2. Start the backend, web and admin

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d --build
```

The first build takes about 10 minutes. Run it again after pulling new code.

## 3. Start the phone app (Android and iPhone)

Open a **second terminal**, in the project folder:

```bash
pnpm phone
```

Add `--clear` after config changes: `pnpm phone --clear`. Keep this terminal open.

On the phone:

1. Install **Expo Go** and sign in with the same Expo account as the PC (`npx expo whoami` in `apps/mobile`).
2. Join the **same Wi-Fi** as the PC.
3. Scan the QR code: iPhone camera, or the scanner inside Expo Go on Android.
4. Wait for **Phone app is ready**, then open the app. Press `r` in the terminal to reload.

To open the app in Safari on iPhone, go to `http://<PC IP>:8081`. `pnpm phone` prints the IP. If the PC changes Wi-Fi, stop it with `Ctrl+C` and run `pnpm phone` again.

## Where it runs

| What | Address |
|---|---|
| Web app | http://localhost:3000 |
| Admin app | http://localhost:3001 (sign in with `CAREERPILOT_OWNER_EMAIL`) |
| Phone app (Metro) | http://localhost:8081, or `exp://<PC IP>:8081` in Expo Go |
| User API / docs | http://localhost:8000/docs |
| Admin API / docs | http://localhost:8001/docs |
| Emails (sign-up and password links) | Mailpit: http://localhost:8025 |
| Background jobs | Temporal: http://localhost:8233 |

## Logs

| What | Where |
|---|---|
| All services, searchable | Grafana: http://localhost:3100 (`admin` / `admin`) → **Explore** → **Loki** |
| One service, live | `docker compose logs -f user-api` (or `admin-api`, `workers`, `web`, `admin`) |
| Everything, live | `docker compose logs -f` |
| Phone app and Metro errors | The terminal running `pnpm phone` |
| Running containers | `docker compose ps`, or Docker Desktop → **Containers** |

## Tests

```bash
pnpm test                                               # web, admin, mobile, packages
cd services/core && ../.venv/Scripts/python -m pytest   # backend
```

## Stop

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml down
```

Press `Ctrl+C` in the `pnpm phone` terminal. Your data stays; never add `-v`, which deletes it.
