#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ENV="$PROJECT_ROOT/.env.runtime"

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command '$1' is not installed"
}

require_environment() {
  [[ -f "$PROJECT_ROOT/.env" ]] || die "copy .env.example to .env and replace local placeholders"
  if grep -q 'replace-with-a-local' "$PROJECT_ROOT/.env"; then
    die ".env still contains replace-with-a-local placeholders"
  fi
}

supabase_cli() {
  (cd "$PROJECT_ROOT" && pnpm exec supabase "$@")
}

write_runtime_environment() {
  local status_output anon_key
  status_output="$(supabase_cli status -o env)"
  anon_key="$(printf '%s\n' "$status_output" | sed -n 's/^ANON_KEY="\{0,1\}\([^"[:space:]]*\)"\{0,1\}$/\1/p')"
  [[ -n "$anon_key" ]] || die "Supabase CLI did not report ANON_KEY"

  umask 077
  printf 'SUPABASE_ANON_KEY=%s\n' "$anon_key" > "$RUNTIME_ENV"
}

compose() {
  docker compose \
    --project-directory "$PROJECT_ROOT" \
    --env-file "$PROJECT_ROOT/.env" \
    --env-file "$RUNTIME_ENV" \
    -f "$PROJECT_ROOT/compose.yaml" "$@"
}

wait_for_url() {
  local name="$1" url="$2" attempts=0
  until curl --fail --silent --show-error --max-time 4 "$url" >/dev/null; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 60 ]]; then
      die "$name did not become ready at $url"
    fi
    sleep 2
  done
  printf 'ready: %s (%s)\n' "$name" "$url"
}

start_stack() {
  require_command docker
  require_command pnpm
  require_command curl
  require_environment

  supabase_cli start
  write_runtime_environment
  compose up --detach --build

  wait_for_url "web" "http://localhost:3000/api/health"
  wait_for_url "api" "http://localhost:8000/health/ready"
  wait_for_url "n8n" "http://localhost:5678/healthz"
  wait_for_url "simulator" "http://localhost:8081/health/ready"

  printf '\nNueva Ruta local services:\n'
  printf '  Web:        http://localhost:3000\n'
  printf '  FastAPI:    http://localhost:8000/docs\n'
  printf '  n8n:        http://localhost:5678\n'
  printf '  Simulator:  http://localhost:8081/docs\n'
  printf '  Supabase:   http://localhost:54323\n'
}

stop_stack() {
  require_command pnpm
  if [[ -f "$PROJECT_ROOT/.env" && -f "$RUNTIME_ENV" ]]; then
    require_command docker
    compose down
  fi
  supabase_cli stop
}

reset_database() {
  require_command pnpm
  supabase_cli db reset
}

verify_stack() {
  require_command curl
  require_environment
  [[ -f "$RUNTIME_ENV" ]] || die "runtime environment is missing; run start first"

  wait_for_url "web" "http://localhost:3000/api/health"
  wait_for_url "web-to-api" "http://localhost:3000/api/diagnostics"
  wait_for_url "api" "http://localhost:8000/health/ready"
  wait_for_url "n8n" "http://localhost:5678/healthz"
  wait_for_url "simulator" "http://localhost:8081/health/ready"

  local smoke_token
  smoke_token="$(sed -n 's/^SMOKE_TEST_TOKEN=//p' "$PROJECT_ROOT/.env" | tail -n 1)"
  [[ -n "$smoke_token" ]] || die "SMOKE_TEST_TOKEN is missing"
  curl --fail --silent --show-error \
    --request POST \
    --header "Authorization: Bearer $smoke_token" \
    "http://localhost:3000/api/smoke/auth" >/dev/null
  printf 'ready: authenticated SSR session smoke\n'
}

case "${1:-}" in
  start) start_stack ;;
  stop) stop_stack ;;
  reset) reset_database ;;
  verify) verify_stack ;;
  *) die "usage: $0 {start|stop|reset|verify}" ;;
esac

