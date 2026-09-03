#!/usr/bin/env bash
# Reclaim disk on the EC2 box before/around a deploy.
#   APP_ROOT        release root (default /opt/alkem-hrms)
#   RELEASE_ID      the release currently being activated (never pruned)
#   KEEP_RELEASES   how many old releases to keep (default 2)
#   AGGRESSIVE=1    also clear npm cache + apt lists + old journald logs
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/alkem-hrms}"
KEEP_RELEASES="${KEEP_RELEASES:-2}"
RELEASE_ID="${RELEASE_ID:-}"

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared" "$APP_ROOT/shared/logs"

# prune old releases, keeping the newest N and the one being deployed
if [ -d "$APP_ROOT/releases" ]; then
  mapfile -t rels < <(ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null || true)
  kept=0
  for d in "${rels[@]}"; do
    name="$(basename "$d")"
    if [ "$name" = "$RELEASE_ID" ]; then continue; fi
    kept=$((kept + 1))
    if [ "$kept" -gt "$KEEP_RELEASES" ]; then
      echo "pruning old release $name"
      rm -rf "$d"
    fi
  done
fi

if [ "${AGGRESSIVE:-0}" = "1" ]; then
  npm cache clean --force >/dev/null 2>&1 || true
  rm -rf ~/.npm/_cacache >/dev/null 2>&1 || true
  sudo rm -rf /var/lib/apt/lists/* >/dev/null 2>&1 || true
  sudo journalctl --vacuum-time=3d >/dev/null 2>&1 || true
  pm2 flush >/dev/null 2>&1 || true
fi

echo "disk after cleanup:"
df -h "$APP_ROOT" | tail -n1 || true
