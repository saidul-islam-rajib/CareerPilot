# Run CareerPilot locally

Everything runs on your own machine. Nothing here sends real applications, emails, or payments.

## What you need

| Tool | Needed for |
|---|---|
| Docker Desktop (running) | Everything below except option C |
| Git | Getting the code |
| Node.js 24 + pnpm (`npm i -g pnpm`) | Mobile app, running web apps without Docker |
| Python 3.11 | Running the backend without Docker |

## A. Everything in Docker (recommended)

Run these in Git Bash or PowerShell from the project folder:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d --build
```

The first build takes about 10 minutes; later starts take seconds. Leave out `-f docker-compose.observability.yml` if you don't need Grafana.

| Open | URL | Sign in |
|---|---|---|
| User web app | http://localhost:3000 | `admin@sober.com` / `admin@sober.com` |
| Admin app | http://localhost:3001 | `admin@sober.com` / `admin@sober.com` |
| User API docs | http://localhost:8000/docs | — |
| Admin API docs | http://localhost:8001/docs | — |
| Mailpit (all local email) | http://localhost:8025 | — |
| Grafana (logs, traces, metrics) | http://localhost:3100 → Dashboards → CareerPilot | `admin` / `admin` |
| Temporal (scheduled discovery runs) | http://localhost:8233 | — |

`127.0.0.1` works as well as `localhost`.

Useful commands:

```bash
docker compose ps                                   # what is running
docker compose logs -f user-api                     # follow API logs
docker compose up -d --build user-api admin-api     # rebuild after backend changes
docker compose up -d --build web admin              # rebuild after web changes
docker compose -f docker-compose.yml -f docker-compose.observability.yml down       # stop (keeps data)
docker compose -f docker-compose.yml -f docker-compose.observability.yml down -v    # stop and wipe all local data
```

After five wrong passwords for the same email, sign-in is locked for 15 minutes. To unlock right away:

```bash
docker compose exec redis-coord redis-cli FLUSHDB
```

## B. Mobile app (Android, iOS, or browser)

Install on your phone: **Expo Go** — [Android (Google Play)](https://play.google.com/store/apps/details?id=host.exp.exponent) · [iPhone (App Store)](https://apps.apple.com/app/expo-go/id982107779). The phone and the PC must be on the same Wi-Fi. The project uses Expo SDK 57; if Expo Go says the project is incompatible, update Expo Go from the store.

Optional, for an Android emulator on the PC: [Android Studio](https://developer.android.com/studio) → More Actions → Virtual Device Manager → create and start a phone. An iOS simulator needs a Mac with Xcode; on Windows use a real iPhone with Expo Go.

### B1. Demo data (no backend needed)

```powershell
pnpm install
pnpm --filter @careerpilot/mobile start
```

Scan the QR code: with the phone camera on iPhone, or from inside Expo Go on Android. In the terminal, press `a` to open the Android emulator, `w` for the browser, `r` to reload. Sign in with `admin@sober.com` / `admin@sober.com`.

### B2. Real backend (Docker from option A)

1. Find your PC's Wi-Fi address: run `ipconfig` and copy the **IPv4 Address** of the Wi-Fi adapter (for example `192.168.0.103`).
2. Let the user API accept connections from your Wi-Fi: in `.env` set `CAREERPILOT_USER_API_BIND=0.0.0.0`, then run `docker compose up -d user-api`. Set it back to `127.0.0.1` when you're done.
3. Start the app against that address (PowerShell):

```powershell
$env:APP_ENV = "http"; $env:CAREERPILOT_API_URL = "http://192.168.0.103:8000"; pnpm --filter @careerpilot/mobile start
```

Git Bash: `APP_ENV=http CAREERPILOT_API_URL=http://192.168.0.103:8000 pnpm --filter @careerpilot/mobile start`

Android emulator only (no `.env` change needed): use `http://10.0.2.2:8000` as the address. Browser on the PC: `APP_ENV=http pnpm --filter @careerpilot/mobile web`.

When Windows Firewall asks about Node.js or Docker, allow **Private networks**.

## C. Without Docker (fastest for front-end work)

```bash
pnpm install
pnpm --filter @careerpilot/web dev      # http://localhost:3000, built-in demo data
pnpm --filter @careerpilot/admin dev    # http://localhost:3001, built-in demo data
```

Backend with Python only (in-memory data, no database or Redis needed):

```bash
cd services
python -m venv .venv
.venv/Scripts/python -m pip install -e "core[dev]" -e api
.venv/Scripts/python -m careerpilot_api.dev_server   # user API :8000, admin API :8001
```

## Tests

```bash
pnpm test                                                   # all TypeScript tests (web, admin, mobile, packages)
cd services/core && ../.venv/Scripts/python -m pytest       # backend tests
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "We couldn't load this" right after a rebuild | The API restarts for about 30 seconds after `--build`; the apps retry automatically. If it persists, see the next row. |
| "We couldn't load this" on sign-in | Run `docker compose ps`: `user-api` and `admin-api` must be `Up`. If not, check `docker compose logs migrate`. |
| Port already in use | Stop the other program, or stop old containers with `docker compose down`. |
| "Too many attempts" | Wait 15 minutes or run the Redis `FLUSHDB` command above. |
| Old screens after changing code | Rebuild with `--build` (option A). |
| Phone shows "We couldn't load this" (option B2) | Check the phone can open `http://<your IPv4>:8000/v1/config` in its browser. If not: same Wi-Fi? `CAREERPILOT_USER_API_BIND=0.0.0.0` in `.env` and `docker compose up -d user-api`? Firewall allowed? |
| Expo Go can't open the project / QR code times out | Same Wi-Fi on both; allow Node.js in Windows Firewall; or start with `pnpm --filter @careerpilot/mobile start --tunnel`. |
| "Project is incompatible with this version of Expo Go" | Update Expo Go from the store (the project uses Expo SDK 57). |
