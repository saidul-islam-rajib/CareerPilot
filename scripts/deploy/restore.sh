#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

APP_SERVICES=(user-api admin-api workers)

usage() {
  printf 'usage: %s --yes database.dump [files.tgz]\n' "$0" >&2
  printf 'Replaces the live database (and uploaded files) with the backup. Run backup.sh first if unsure.\n' >&2
  exit 2
}

restore_database() {
  local dump="$1" user db
  user="$(env_value POSTGRES_USER)"
  db="$(env_value POSTGRES_DB)"
  compose exec -T postgres pg_restore -U "$user" -d "$db" --clean --if-exists --no-owner <"$dump"
}

restore_files() {
  local archive="$1"
  compose up -d user-api
  compose exec -T user-api sh -c 'rm -rf /data/files/* && tar xzf - -C /data' <"$archive"
}

main() {
  [ "${1:-}" = "--yes" ] || usage
  shift
  local dump="${1:-}" archive="${2:-}"
  [ -n "$dump" ] && [ -f "$dump" ] || usage
  [ -z "$archive" ] || [ -f "$archive" ] || usage
  require_env_file
  compose stop "${APP_SERVICES[@]}"
  restore_database "$dump"
  [ -z "$archive" ] || restore_files "$archive"
  compose run --rm migrate
  compose up -d
  bash "$DEPLOY_DIR/health-check.sh"
  say "restored from $dump"
}

main "$@"
