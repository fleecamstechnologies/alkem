// PM2 config for the Alkem HRMS API.
// APP_ROOT / APP_NAME are exported by the deploy workflow before `pm2 start`.
const path = require('path');

const APP_ROOT = process.env.APP_ROOT || '/opt/alkem-hrms';
const APP_NAME = process.env.APP_NAME || 'alkem-hrms-api';
const cwd = path.join(APP_ROOT, 'current', 'backend');

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
      // dist/main.js loads .env from cwd via @nestjs/config + dotenv
      env: { NODE_ENV: 'production' },
      out_file: path.join(APP_ROOT, 'shared', 'logs', 'api-out.log'),
      error_file: path.join(APP_ROOT, 'shared', 'logs', 'api-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
