# Deploy to the VPS (76.13.223.106)

A self-contained deploy that runs **on the VPS** from a git checkout — no GitHub
Actions, no rsync from a runner. (The `.github/workflows/deploy.yml` + `scripts/ec2/`
kit still work if you'd rather push-deploy; this is the simpler path for a single
box you SSH into.)

## 0. Get the code onto the box

```bash
ssh root@76.13.223.106            # or your sudo user
sudo mkdir -p /opt/alkem-hrms
sudo git clone <YOUR_REPO_URL> /opt/alkem-hrms/repo
# (no remote yet? scp the folder up:  rsync -az ./ root@76.13.223.106:/opt/alkem-hrms/repo/)
```

## 1. One-time bootstrap (installs Node 20, pm2, nginx, MySQL; writes env + nginx)

```bash
cd /opt/alkem-hrms/repo
sudo DB_PASSWORD='CHOOSE_A_DB_PASSWORD' \
     JWT_SECRET="$(openssl rand -hex 32)" \
     REPO_URL='<YOUR_REPO_URL>' \
     bash scripts/vps/bootstrap.sh
```

- Using a managed MySQL / RDS instead? Skip the DB vars, let it install nothing,
  then edit `/opt/alkem-hrms/shared/backend.env` and set `DB_HOST` / `DB_PORT` /
  `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` yourself.
- Run the `sudo env PATH=... pm2 startup ...` line it prints so pm2 survives reboot.

## 2. Deploy (build + migrate + restart) — re-run this for every release

```bash
sudo bash /opt/alkem-hrms/repo/scripts/vps/deploy.sh --pull --seed
```

- `--pull` → `git pull --ff-only` first.
- `--seed` → run the idempotent DB seed (do it once, on the first deploy; omit
  afterwards). Demo login: `admin@alkem.local` / `ChangeMe123!`.

The script builds `backend/` (`nest build`) and `frontend/`
(`VITE_API_BASE_URL=/api vite build`), copies `shared/backend.env` →
`backend/.env`, runs `typeorm migration:run -d dist/data-source.js`, restarts the
pm2 app `alkem-hrms-api`, reloads nginx, and health-checks
`http://127.0.0.1:$PORT/api/health`.

Right after step 2 the app is live at **http://76.13.223.106/**.

## 3. Domain + HTTPS (medical.fleecams.com)

```bash
# point an A record:  medical.fleecams.com -> 76.13.223.106
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d medical.fleecams.com
```

certbot adds the `listen 443 ssl` block and switches port 80 to a redirect.

## Day-2

| Task | Command |
|---|---|
| Logs | `pm2 logs alkem-hrms-api` |
| Status | `pm2 status` / `curl -s localhost:3005/api/health` |
| Restart only | `pm2 restart alkem-hrms-api --update-env` |
| New release | `sudo bash /opt/alkem-hrms/repo/scripts/vps/deploy.sh --pull` |
| Rollback | `cd /opt/alkem-hrms/repo && git checkout <old-sha> && sudo bash scripts/vps/deploy.sh` |
| Revert a migration | `cd backend && node ./node_modules/typeorm/cli.js migration:revert -d dist/data-source.js` |
| Change env | edit `/opt/alkem-hrms/shared/backend.env`, then re-run `deploy.sh` (or `pm2 restart`) |

## Firewall

Open **80** and **443** (and **22** for yourself):

```bash
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```
