#!/usr/bin/env bash
# Install production node_modules for the freshly-uploaded backend release.
#   BACKEND_DIR   defaults to $APP_ROOT/current/backend
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/alkem-hrms}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/current/backend}"

cd "$BACKEND_DIR"
test -f package-lock.json || { echo "no package-lock.json in $BACKEND_DIR" >&2; exit 1; }

# runtime only — the app is already compiled to dist/
npm ci --omit=dev --no-audit --no-fund

# sanity: the bits the deploy step relies on must resolve
node -e "require('typeorm'); require('reflect-metadata'); require('mysql2'); console.log('backend runtime deps ok')"
