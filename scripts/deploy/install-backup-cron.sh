#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SCHEDULE="${CAREERPILOT_BACKUP_SCHEDULE:-30 2 * * *}"
MARKER="# careerpilot-nightly-backup"
LOG_FILE="${CAREERPILOT_BACKUP_LOG:-$HOME/careerpilot-backup.log}"

main() {
  local entry current
  entry="$SCHEDULE cd $REPO_ROOT && bash scripts/deploy/backup.sh >>$LOG_FILE 2>&1 $MARKER"
  current="$(crontab -l 2>/dev/null | grep -v "$MARKER" || true)"
  printf '%s\n%s\n' "$current" "$entry" | sed '/^$/d' | crontab -
  say "nightly backup installed: $SCHEDULE (log: $LOG_FILE)"
}

main "$@"
