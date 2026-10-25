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

```bash
pnpm install
pnpm --filter @careerpilot/mobile start        # scan the QR code with Expo Go, or press a (Android) / i (iOS) / w (browser)
```

This uses the built-in demo data. To use the Docker backend from option A instead (browser or emulator on the same PC):

```bash
APP_ENV=http pnpm --filter @careerpilot/mobile web
```

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
| "We couldn't load this" on sign-in | Run `docker compose ps`: `user-api` and `admin-api` must be `Up`. If not, check `docker compose logs migrate`. |
| Port already in use | Stop the other program, or stop old containers with `docker compose down`. |
| "Too many attempts" | Wait 15 minutes or run the Redis `FLUSHDB` command above. |
| Old screens after changing code | Rebuild with `--build` (option A). |
