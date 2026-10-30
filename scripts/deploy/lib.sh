#!/usr/bin/env bash

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"
ENV_FILE="${CAREERPILOT_ENV_FILE:-$REPO_ROOT/.env}"
PROJECT_NAME="${CAREERPILOT_PROJECT:-careerpilot-prod}"
DEFAULT_RETENTION_DAYS=14
DEFAULT_HTTP_PORT=80
DEFAULT_HTTPS_PORT=443
HEALTH_WAIT_SECONDS="${CAREERPILOT_HEALTH_WAIT:-300}"
HEALTH_POLL_SECONDS=5

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

env_value() {
  local name="$1"
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^${name}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true
}

require_env_file() {
  [ -f "$ENV_FILE" ] || fail "missing $ENV_FILE (copy .env.production.example to .env and fill it in)"
}

compose() {
  local files=(-f "$REPO_ROOT/docker-compose.prod.yml")
  if [ "${CAREERPILOT_TOOLS:-0}" = "1" ]; then
    files+=(-f "$REPO_ROOT/docker-compose.prod.tools.yml" --profile tools)
  fi
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" "${files[@]}" "$@"
}

backup_dir() {
  local configured
  configured="$(env_value CAREERPILOT_BACKUP_DIR)"
  printf '%s' "${configured:-$HOME/careerpilot-backups}"
}

retention_days() {
  local configured
  configured="$(env_value CAREERPILOT_BACKUP_RETENTION_DAYS)"
  printf '%s' "${configured:-$DEFAULT_RETENTION_DAYS}"
}

timestamp() {
  date -u +%Y%m%d-%H%M%S
}
