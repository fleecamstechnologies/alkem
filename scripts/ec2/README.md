# Deploy — medical.fleecams.com

CI/CD lives in [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).

- **CI** runs on every push to `main` and on demand: installs both apps, builds
  the backend (`nest build`) and frontend (`tsc -b && vite build`), and applies
  all TypeORM migrations against a throwaway MySQL 8 container so a broken
  migration fails the build.
- **Deploy** runs after CI on `main` (or via *Run workflow*): builds a release
  bundle, `rsync`s it to the EC2 box under `/opt/alkem-hrms/releases/<sha>-<n>/`,
  points `current` at it, installs runtime deps, runs migrations, optionally
  seeds, (re)starts the API under **pm2**, and health-checks
  `https://medical.fleecams.com/api/health`.

## One-time server provisioning (Ubuntu 22.04+ EC2)

```bash
sudo apt-get update
sudo apt-get install -y nginx rsync curl
# Node 20 + pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm i -g pm2
# MySQL 8 (or point DB_HOST at RDS instead)
sudo apt-get install -y mysql-server
sudo mysql -e "CREATE DATABASE alkem_portal CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'alkem'@'localhost' IDENTIFIED BY 'REPLACE_ME';"
sudo mysql -e "GRANT ALL ON alkem_portal.* TO 'alkem'@'localhost'; FLUSH PRIVILEGES;"

# release layout
sudo mkdir -p /opt/alkem-hrms/{releases,shared/logs}
sudo chown -R "$USER":"$USER" /opt/alkem-hrms

# make pm2 resurrect on boot
pm2 startup    # run the command it prints
```

### backend.env

The workflow seeds `/opt/alkem-hrms/shared/backend.env` from the `BACKEND_ENV`
secret (or from `DB_PASSWORD` + `JWT_SECRET`) on the first deploy and never
overwrites it afterwards. To manage it by hand:

```bash
sudo install -m 600 /dev/stdin /opt/alkem-hrms/shared/backend.env <<'EOF'
NODE_ENV=production
PORT=3005
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=alkem
DB_PASSWORD=REPLACE_ME
DB_DATABASE=alkem_portal
DB_POOL_SIZE=20
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_STRING
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://medical.fleecams.com
EOF
```

### nginx + TLS

```bash
sudo cp scripts/ec2/nginx.medical.fleecams.com.conf /etc/nginx/sites-available/medical.fleecams.com
sudo ln -s ../sites-available/medical.fleecams.com /etc/nginx/sites-enabled/
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d medical.fleecams.com     # issues the cert + wires 80->443
sudo nginx -t && sudo systemctl reload nginx
```

Point an `A` record for `medical.fleecams.com` at the EC2 elastic IP, and open
security-group ports **80** and **443** (and **22** to the runner).

## GitHub secrets (repo → Settings → Secrets → Actions)

Attach these to a **`production`** environment (the deploy job uses
`environment: production`).

| Secret | Required | Notes |
|---|---|---|
| `EC2_HOST` | yes | public DNS / elastic IP |
| `EC2_USER` | yes | e.g. `ubuntu` |
| `EC2_SSH_KEY` | yes | private key (PEM) for that user |
| `EC2_SSH_PORT` | no | defaults to `22` |
| `BACKEND_ENV` | recommended | full dotenv, used verbatim on first deploy |
| `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_DATABASE` | fallback | used to assemble `backend.env` if `BACKEND_ENV` is unset |
| `JWT_SECRET` `JWT_EXPIRES_IN` `APP_PORT` | fallback | same |

## First data load

Trigger **Run workflow** with `run_seed = true` once (or run
`node dist/seed.js` on the server). Seeding is idempotent — every seeder guards
on existing rows — so it's safe to leave off for normal deploys. Demo logins:
`admin@alkem.local` / `ChangeMe123!`.

## Rollback

```bash
ls -1dt /opt/alkem-hrms/releases/*/          # pick a previous release
ln -sfn /opt/alkem-hrms/releases/<id> /opt/alkem-hrms/current
cp /opt/alkem-hrms/shared/backend.env /opt/alkem-hrms/current/backend/.env
cd /opt/alkem-hrms/current/backend && npm ci --omit=dev
pm2 restart alkem-hrms-api --update-env
```
(Migrations are forward-only — roll the DB back with
`node ./node_modules/typeorm/cli.js migration:revert -d dist/data-source.js` if needed.)
