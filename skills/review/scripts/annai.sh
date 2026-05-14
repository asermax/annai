#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"

if [[ ! -f "$APP_DIR/node_modules/.installed" || ! -f "$APP_DIR/dist/cli.js" ]]; then
  LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/annai"
  mkdir -p "$LOG_DIR"
  LOG_FILE="$LOG_DIR/bootstrap-$(date +%s).log"
  echo "annai: first run, installing dependencies and building (log: $LOG_FILE)..." >&2
  if ! (cd "$APP_DIR" && npm install --no-fund --no-audit && npm run build) > "$LOG_FILE" 2>&1; then
    echo "annai: bootstrap failed; last 50 lines from $LOG_FILE:" >&2
    tail -n 50 "$LOG_FILE" >&2
    exit 1
  fi
  touch "$APP_DIR/node_modules/.installed"
fi

exec node "$APP_DIR/dist/cli.js" "$@"
