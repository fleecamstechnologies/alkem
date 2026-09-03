#!/usr/bin/env bash
# Build + release Alkem HRMS from the git checkout at APP_ROOT/repo.
# Run on the VPS after bootstrap.sh.  Re-run for every deploy.
#
#   sudo bash /opt/alkem-hrms/repo/scripts/vps/deploy.sh [--pull] [--seed]
#
#     --pull   git pull --ff-only before building
#     --seed   run the (idempotent) DB seed after migrating
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/alkem-hrms}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
SHARED="${SHARED:-$APP_ROOT/shared}"
APP_NAME="${APP_NAME:-alkem-hrms-api}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}"

DO_PULL=0; DO_SEED=0
for a in "$@"; do
  case "$a" in
    --pull) DO_PULL=1 ;;
    --seed) DO_SEED=1 ;;
    *) echo "unknown flag: $a" >&2; exit 1 ;;
  esac
done

cd "$REPO_DIR"
test -f backend/package.json || { echo "no repo at $REPO_DIR" >&2; exit 1; }
test -s "$SHARED/backend.env" || { echo "missing $SHARED/backend.env — run bootstrap.sh" >&2; exit 1; }

if [ "$DO_PULL" = 1 ]; then
  [ -d .git ] || { echo "--pull needs a git checkout at $REPO_DIR" >&2; exit 1; }
  echo "== git pull =="
  git pull --ff-only
fi
if [ -d .git ]; then echo "deploying $(git rev-parse --short HEAD)"; else echo "deploying (rsync snapshot)"; fi

# npm install (not ci): the lockfile may have been generated on a different OS,
# so platform-specific optional deps (esbuild/rollup/emnapi) can differ.
NPM_INSTALL="npm install --no-audit --no-fund --loglevel=error"

echo "== backend build =="
( cd backend && $NPM_INSTALL && npm run build )

echo "== frontend build =="
( cd frontend && $NPM_INSTALL && VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build )

echo "== env =="
install -m 600 "$SHARED/backend.env" "$REPO_DIR/backend/.env"
APP_PORT="$(grep -E '^PORT=' "$REPO_DIR/backend/.env" | tail -n1 | cut -d= -f2)"
APP_PORT="${APP_PORT:-3005}"

echo "== migrations =="
( cd backend && node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js )

if [ "$DO_SEED" = 1 ]; then
  echo "== seed (idempotent) =="
  ( cd backend && node dist/seed.js )
fi

echo "== (re)start api on :$APP_PORT =="
mkdir -p "$SHARED/logs"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
# free the port if something orphaned is holding it
pids="$(ss -lptnH "sport = :$APP_PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
[ -z "$pids" ] && pids="$(fuser "${APP_PORT}/tcp" 2>/dev/null | tr -s ' ' '\n' | sort -u || true)"
if [ -n "$pids" ]; then echo "clearing pid(s) $pids on :$APP_PORT"; kill $pids 2>/dev/null || true; sleep 2; kill -9 $pids 2>/dev/null || true; fi

export REPO_DIR APP_NAME
pm2 start "$REPO_DIR/scripts/vps/ecosystem.config.cjs" --only "$APP_NAME" --update-env
pm2 save

echo "== nginx =="
nginx -t && systemctl reload nginx

echo "== health check =="
for i in $(seq 1 30); do
  if curl -sf --max-time 3 "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
    echo "OK — API healthy on :${APP_PORT} (try $i)"
    curl -s "http://127.0.0.1:${APP_PORT}/api/health"; echo
    exit 0
  fi
  st="$(pm2 jlist 2>/dev/null | node -e 'try{const a=JSON.parse(require("fs").readFileSync(0));const p=a.find(x=>x.name===process.env.APP_NAME);process.stdout.write(p?p.pm2_env.status:"none")}catch(e){process.stdout.write("?")}' || true)"
  if [ "$st" = "errored" ] || [ "$st" = "stopped" ]; then
    pm2 logs "$APP_NAME" --lines 120 --nostream || true
    echo "pm2 process is $st" >&2; exit 1
  fi
  sleep 2
done
pm2 logs "$APP_NAME" --lines 120 --nostream || true
echo "API did not become healthy" >&2
exit 1
