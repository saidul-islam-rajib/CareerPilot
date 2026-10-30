#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REMOTE_DIR="careerpilot"

usage() {
  printf 'usage: %s user@host [--dir remote-folder] [--ref tag-or-branch] [--identity key-file]\n' "$0" >&2
  exit 2
}

main() {
  [ $# -ge 1 ] || usage
  local target="$1" dir="$DEFAULT_REMOTE_DIR" ref="" identity=""
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --dir) dir="${2:?}"; shift 2 ;;
      --ref) ref="${2:?}"; shift 2 ;;
      --identity) identity="${2:?}"; shift 2 ;;
      *) usage ;;
    esac
  done
  local ssh_args=(-o BatchMode=yes -o ServerAliveInterval=30)
  [ -z "$identity" ] || ssh_args+=(-i "$identity")
  local remote_args=""
  [ -z "$ref" ] || remote_args="--ref $(printf '%q' "$ref")"
  ssh "${ssh_args[@]}" "$target" "cd $(printf '%q' "$dir") && bash scripts/deploy/deploy.sh $remote_args"
}

main "$@"
