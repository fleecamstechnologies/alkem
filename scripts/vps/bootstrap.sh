#!/usr/bin/env bash
# One-time VPS provisioning for Alkem HRMS.  Run as root (or with sudo) on
# 76.13.223.106.  Idempotent — safe to re-run.
#
#   REPO_URL   git URL to clone (skip if the repo is already at APP_ROOT/repo)
#   DB_PASSWORD, JWT_SECRET   used to write shared/backend.env on first run
#
# Example:
#   sudo REPO_URL=https://github.com/<you>/alkem.git \
#        DB_PASSWORD='s3cret' JWT_SECRET="$(openssl rand -hex 32)" \
#        bash scripts/vps/bootstrap.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/alkem-hrms}"
REPO_DIR="$APP_ROOT/repo"
SHARED="$APP_ROOT/shared"
DOMAIN="${DOMAIN:-medical.fleecams.com}"
SERVER_IP="${SERVER_IP:-76.13.223.106}"
APP_PORT="${APP_PORT:-3005}"
DB_NAME="${DB_NAME:-alkem_portal}"
DB_USER="${DB_USER:-alkem}"

need_root() { [ "$(id -u)" = "0" ] || { echo "run with sudo/root" >&2; exit 1; }; }
need_root

echo "== packages =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git rsync nginx ca-certificates

if ! node -v 2>/dev/null | grep -qE '^v(2[0-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm i -g pm2

echo "== mysql (skip if you use a managed DB — set DB_HOST in backend.env) =="
if ! command -v mysql >/dev/null; then
  apt-get install -y mysql-server
  systemctl enable --now mysql
fi
if [ -n "${DB_PASSWORD:-}" ]; then
  # pick a way to talk to MySQL as an admin
  if sudo mysql -e 'SELECT 1' >/dev/null 2>&1; then MYSQL='sudo mysql'
  elif mysql --defaults-file=/etc/mysql/debian.cnf -e 'SELECT 1' >/dev/null 2>&1; then
    MYSQL='mysql --defaults-file=/etc/mysql/debian.cnf'
  else MYSQL='mysql'; fi
  $MYSQL -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  $MYSQL -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
  $MYSQL -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
  $MYSQL -e "GRANT ALL ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"
fi

echo "== layout =="
mkdir -p "$APP_ROOT" "$SHARED/logs"
if [ ! -d "$REPO_DIR/.git" ]; then
  [ -n "${REPO_URL:-}" ] || { echo "REPO_DIR has no git repo and REPO_URL is unset" >&2; exit 1; }
  git clone "$REPO_URL" "$REPO_DIR"
fi

echo "== shared/backend.env =="
if [ ! -s "$SHARED/backend.env" ]; then
  : "${DB_PASSWORD:?set DB_PASSWORD to write backend.env}"
  : "${JWT_SECRET:?set JWT_SECRET to write backend.env}"
  cat > "$SHARED/backend.env" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=${DB_NAME}
DB_POOL_SIZE=20
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://${DOMAIN}
EOF
  chmod 600 "$SHARED/backend.env"
  echo "wrote $SHARED/backend.env"
else
  echo "keeping existing $SHARED/backend.env"
fi

echo "== nginx site =="
sed -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__SERVER_IP__/${SERVER_IP}/g" \
    -e "s/__APP_PORT__/${APP_PORT}/g" \
    -e "s#__FRONTEND_ROOT__#${REPO_DIR}/frontend/dist#g" \
    "$REPO_DIR/scripts/vps/nginx.conf" > /etc/nginx/sites-available/alkem-hrms
ln -sfn /etc/nginx/sites-available/alkem-hrms /etc/nginx/sites-enabled/alkem-hrms
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "== pm2 boot =="
_pm2_user="${SUDO_USER:-root}"
_pm2_home="$(getent passwd "$_pm2_user" | cut -d: -f6)"
pm2 startup systemd -u "$_pm2_user" --hp "${_pm2_home:-/root}" >/tmp/pm2-startup 2>&1 || true
echo "  (if pm2 printed a 'sudo env ...' line above, run it once)"
grep -E 'sudo env' /tmp/pm2-startup | tail -n1 || true

cat <<DONE

Bootstrap done. Next:
  1) DNS: point ${DOMAIN}  A  -> ${SERVER_IP}
  2) Deploy:   sudo bash ${REPO_DIR}/scripts/vps/deploy.sh --seed
  3) TLS:      sudo apt-get install -y certbot python3-certbot-nginx
               sudo certbot --nginx -d ${DOMAIN}
The app is reachable at  http://${SERVER_IP}/  until DNS + TLS are set up.
DONE
