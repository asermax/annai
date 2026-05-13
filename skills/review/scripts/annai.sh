#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"

if [[ ! -f "$APP_DIR/node_modules/.installed" ]]; then
  echo "annai: first run, installing dependencies..." >&2
  (cd "$APP_DIR" && npm install --no-fund --no-audit --omit=dev)
  touch "$APP_DIR/node_modules/.installed"
fi

exec node "$APP_DIR/dist/cli.js" "$@"
