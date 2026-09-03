// PM2 config for a VPS git-checkout deploy (scripts/vps/deploy.sh).
// REPO_DIR / APP_NAME are exported by deploy.sh before `pm2 start`.
const path = require('path');

const REPO_DIR = process.env.REPO_DIR || '/opt/alkem-hrms/repo';
const APP_NAME = process.env.APP_NAME || 'alkem-hrms-api';
const cwd = path.join(REPO_DIR, 'backend');

module.exports = {
  apps: [
    {
      name: APP_NAME,
      cwd,
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 8000,
      env: { NODE_ENV: 'production' }, // dist/main.js loads .env from cwd
      out_file: '/opt/alkem-hrms/shared/logs/api-out.log',
      error_file: '/opt/alkem-hrms/shared/logs/api-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
