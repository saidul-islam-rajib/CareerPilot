#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MIN_FREE_KB=3145728

update_code() {
  local ref="$1"
  cd "$REPO_ROOT"
  git fetch --tags --prune
  if [ -n "$ref" ]; then
    git checkout --detach "$ref"
  else
    git pull --ff-only
  fi
  say "code at $(git rev-parse --short HEAD)"
}

check_disk() {
  local free
  free="$(df -Pk "$REPO_ROOT" | awk 'NR == 2 { print $4 }')"
  [ "$free" -ge "$MIN_FREE_KB" ] || fail "less than 3 GB free disk; free some space first"
}

start_stack() {
  compose build --pull
  compose run --rm migrate
  compose up -d --remove-orphans
}

main() {
  local ref=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --ref) ref="${2:?--ref needs a tag, branch, or commit}"; shift 2 ;;
      *) fail "unknown option: $1" ;;
    esac
  done
  require_env_file
  check_disk
  update_code "$ref"
  start_stack
  bash "$DEPLOY_DIR/health-check.sh"
  docker image prune -f >/dev/null
  say "deployed"
}

main "$@"
exit $?
