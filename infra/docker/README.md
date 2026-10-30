# infra/docker

Dockerfiles for each service.

- `api.Dockerfile`: user API, admin API, workers, migrations (Python).
- `web.Dockerfile`: web and admin apps; build arguments `APP`, `PORT`, `APP_ENV`, `CAREERPILOT_API_URL`, `CAREERPILOT_ADMIN_API_URL`.
- `edge.Dockerfile`: production Caddy (`infra/caddy/Caddyfile`) with the mobile web export baked in.
