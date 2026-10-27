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
| Mailpit (all local email: registration and password-reset links, verification codes) | http://localhost:8025 | — |
| Grafana (logs, traces, metrics) | http://localhost:3100 → Dashboards → CareerPilot | `admin` / `admin` |
| Temporal (scheduled discovery runs) | http://localhost:8233 | — |

`127.0.0.1` works as well as `localhost`.

**Create an account:** open http://localhost:3000/register and enter your name and email (no password yet). Open Mailpit at http://localhost:8025, open **Finish creating your CareerPilot account**, and click the link. Choose your password and you're signed in. **Forgot password?** works the same way with the **Reset your CareerPilot password** email.

**Real inbox delivery (optional):** by default all local email stays in Mailpit. To receive registration and reset emails in a real inbox (sent from `info@team-sober.com`), set `CAREERPILOT_MAIL_USER` and `CAREERPILOT_MAIL_PASSWORD` in `.env` as described in [docs/runbooks/email-setup.md](docs/runbooks/email-setup.md), then run `docker compose up -d user-api`.

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

Install on your phone: **Expo Go** — [Android (Google Play)](https://play.google.com/store/apps/details?id=host.exp.exponent) · [iPhone (App Store)](https://apps.apple.com/app/expo-go/id982107779). The phone and the PC must be on the same Wi-Fi. The project uses Expo SDK 58; if Expo Go says the project is incompatible, update Expo Go from the store.

Expo Go and Expo CLI must use the same Expo account, or both none, or Expo Go refuses to open the project. `pnpm phone` (B2) runs Expo CLI without an account, so keep Expo Go signed out for it. For B1, if you are signed in to Expo Go, sign in to Expo CLI on the PC with the same account once. Type your Expo username and password when asked:

```powershell
npx expo login --no-browser
```

Optional, for an Android emulator on the PC: [Android Studio](https://developer.android.com/studio) → More Actions → Virtual Device Manager → create and start a phone. An iOS simulator needs a Mac with Xcode; on Windows use a real iPhone with Expo Go.

### B1. Demo data (no backend needed)

```powershell
pnpm install
pnpm --filter @careerpilot/mobile start
```

Scan the QR code: with the phone camera on iPhone, or from inside Expo Go on Android. In the terminal, press `a` to open the Android emulator, `w` for the browser, `r` to reload. Sign in with `admin@sober.com` / `admin@sober.com`. With demo data no email is sent: to verify an email address, enter the code `246810`; to create an account, tap **Open the link** on the **Check your email** screen and choose a password.

### B2. Real backend and real email (Docker from option A)

Stop any other Metro first (Ctrl+C in its window), then:

```powershell
pnpm phone
```

It finds your PC's Wi-Fi address, opens the user API to your Wi-Fi, points email links at your PC, starts Metro against the real backend, and pre-builds the app so Expo Go opens it quickly. Scan the QR code it prints. When it says **Phone app is ready**, open the app. Keep Expo Go signed out (see above).

To create an account: register on the phone with your real email address. The link arrives from `info@team-sober.com` within seconds; check Spam the first time (setup: `docs/runbooks/email-setup.md`). Tap the link on the phone: it opens CareerPilot in the phone's browser, where you choose your password. Then go back to Expo Go and sign in. Addresses at `sober.com` and `example.*` never leave the PC; open those in Mailpit (http://localhost:8025).

If port 8081 is busy, it uses the next free port. To choose the address yourself, set `CAREERPILOT_PHONE_HOST`. Pass Expo options after it, for example `pnpm phone --clear`. When Windows Firewall asks about Node.js or Docker, allow **Private networks**. `docker compose up -d user-api` puts email links back to the PC web app.

Android emulator only: `$env:APP_ENV = "http"; $env:CAREERPILOT_API_URL = "http://10.0.2.2:8000"; pnpm --filter @careerpilot/mobile start`. Browser on the PC: `APP_ENV=http pnpm --filter @careerpilot/mobile web`.

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
| "Project is incompatible with this version of Expo Go" | Update Expo Go from the store (the project uses Expo SDK 58). |
| "You're signed in to Expo Go as …, but not signed in to Expo CLI" | Stop Metro (`Ctrl+C`), run `npx expo login --no-browser` with the same Expo account, then start again. Or sign out of Expo Go on the phone. |
| `npx expo login` crashes with "cmd.exe /c start … exited with non-zero code: 1" | Expo CLI can't open the browser on Windows because the login link contains `&`. Use `npx expo login --no-browser`, or run `$env:BROWSER = "none"; npx expo login` and `Ctrl+click` the printed link. |
