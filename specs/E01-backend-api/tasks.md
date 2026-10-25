# E01 Backend API – tasks

- [x] Platform layer: config, clock, ids, errors, security, validation, catalog, seed loader
- [x] Candidate services: auth with consent and sign-in history, opportunities, approvals, applications, profile, preferences, dashboard, public config
- [x] Administration services: permissions, dashboard, users, catalog, platform settings, emergency stop, audit, admin accounts
- [x] FastAPI user and admin apps matching the TypeScript contracts
- [x] Unit tests (39), ruff, pyright strict
- [x] End-to-end check: web and admin apps against the live backend (0 failed requests, 0 console errors)
- [x] PostgreSQL persistence with audit and soft-delete columns, Alembic migrations, seeds (app role without DELETE/TRUNCATE, insert-only audit_events trigger, web and admin validated against it)
- [ ] Normalize candidate workspace documents into per-entity tables (Design/06 ERDs)
- [ ] OpenTelemetry instrumentation
- [ ] Docker Compose for the whole platform
