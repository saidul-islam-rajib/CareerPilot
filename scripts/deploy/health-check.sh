#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SITES=(app admin api admin-api m)
API_PROBE_PATH=/v1/config
MAX_REDIRECTS=3
REQUEST_TIMEOUT=15

site_status() {
  local site="$1" domain prefix http_port path=/
  [ "$site" = "api" ] && path="$API_PROBE_PATH"
  domain="$(env_value CAREERPILOT_DOMAIN)"
  prefix="$(env_value CAREERPILOT_SITE_PREFIX)"
  http_port="$(env_value CAREERPILOT_HTTP_PORT)"
  if [ -n "$prefix" ]; then
    curl -s -o /dev/null -w '%{http_code}' --max-time "$REQUEST_TIMEOUT" -H "Host: ${site}.${domain}" "http://127.0.0.1:${http_port:-$DEFAULT_HTTP_PORT}${path}" || true
  else
    curl -s -o /dev/null -w '%{http_code}' --max-time "$REQUEST_TIMEOUT" --max-redirs "$MAX_REDIRECTS" "https://${site}.${domain}${path}" || true
  fi
}

unhealthy_services() {
  compose ps --format '{{.Service}} {{.State}} {{.Health}}' | awk '
    $2 == "exited" && $1 == "migrate" { next }
    $2 != "running" { print $1; next }
    $3 != "" && $3 != "healthy" { print $1 }
  '
}

check_containers() {
  local deadline=$((SECONDS + HEALTH_WAIT_SECONDS)) bad
  while true; do
    bad="$(unhealthy_services)"
    [ -z "$bad" ] && return 0
    [ "$SECONDS" -ge "$deadline" ] && { say "not healthy: $(echo "$bad" | tr '\n' ' ')"; return 1; }
    sleep "$HEALTH_POLL_SECONDS"
  done
}

check_sites() {
  local failed=0 site code
  for site in "${SITES[@]}"; do
    code="$(site_status "$site")"
    case "$code" in
      2??|3??|401|403|404) say "ok    ${site}  (${code})" ;;
      *) say "FAIL  ${site}  (${code:-no answer})"; failed=1 ;;
    esac
  done
  return "$failed"
}

main() {
  require_env_file
  check_containers || fail "containers are not healthy"
  check_sites || fail "a site did not answer"
  say "all healthy"
}

main "$@"
