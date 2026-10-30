#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DATABASE_PREFIX="careerpilot-db"
FILES_PREFIX="careerpilot-files"

dump_database() {
  local target="$1" user db
  user="$(env_value POSTGRES_USER)"
  db="$(env_value POSTGRES_DB)"
  compose exec -T postgres pg_dump -U "$user" -d "$db" --format=custom --no-owner >"$target"
  [ -s "$target" ] || { rm -f "$target"; fail "database dump is empty"; }
}

archive_files() {
  local target="$1"
  compose exec -T user-api tar czf - -C /data files >"$target"
  [ -s "$target" ] || { rm -f "$target"; fail "files archive is empty"; }
}

remove_old() {
  local dir="$1" days
  days="$(retention_days)"
  find "$dir" -maxdepth 1 -type f \( -name "${DATABASE_PREFIX}-*.dump" -o -name "${FILES_PREFIX}-*.tgz" \) -mtime "+$days" -delete
}

main() {
  require_env_file
  local dir stamp
  dir="$(backup_dir)"
  stamp="$(timestamp)"
  umask 077
  mkdir -p "$dir"
  dump_database "$dir/${DATABASE_PREFIX}-${stamp}.dump"
  archive_files "$dir/${FILES_PREFIX}-${stamp}.tgz"
  remove_old "$dir"
  say "backup saved: $dir/${DATABASE_PREFIX}-${stamp}.dump and ${FILES_PREFIX}-${stamp}.tgz"
}

main "$@"
