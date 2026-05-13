#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"

if [[ ! -f "$APP_DIR/node_modules/.installed" || ! -f "$APP_DIR/dist/cli.js" ]]; then
  echo "annai: first run, installing dependencies and building..." >&2
  (cd "$APP_DIR" && npm install --no-fund --no-audit && npm run build)
  touch "$APP_DIR/node_modules/.installed"
fi

exec node "$APP_DIR/dist/cli.js" "$@"
