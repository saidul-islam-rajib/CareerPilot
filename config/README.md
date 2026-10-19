# Configuration

Every default value in CareerPilot lives here, never in code (ADR 0021, `Planning/19-Development-Rules.md` §3).

- `defaults/*.yaml` — all defaults, one file per bounded context, each key with a schema, description, unit, and allowed range.
- `env/<local|dev|staging|prod>.yaml` — per-environment overrides.

Secrets never go here: they come from environment variables locally and AWS Secrets Manager in the cloud. Values admins may change at runtime are also stored in `platform_settings` and edited in the admin app.
