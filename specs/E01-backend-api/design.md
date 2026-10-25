# E01 Backend API – design

- `services/core` (`careerpilot`): `platform` (config from `config/`, clock, ids, errors, Argon2 hashing, JWT with separate user/admin audiences, validation, shared i18n catalog, seed loader), `candidate` and `administration` contexts (models, ports, services, in-memory adapters), `bootstrap.py` composition root, `api` (FastAPI routers, problem-details errors, CORS and security headers).
- `services/api` (`careerpilot_api`): entry points; `python -m careerpilot_api.dev_server` serves both apps on the configured ports from one container.
- Demo data comes from `seeds/demo/demo-seed.json`, exported from the TypeScript demo seed (`node scripts/seeds/export-demo-seed.mjs`) and shifted to the current date on load, so front ends and backend show the same data.
- Next increment: PostgreSQL adapters (SQLAlchemy 2, Alembic) with audit and soft-delete columns behind the same ports.
