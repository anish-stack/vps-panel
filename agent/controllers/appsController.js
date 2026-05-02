const { safeExec } = require('../utils/shell');

const ALLOWED_APP_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

function validateAppName(name) {
  return name && typeof name === 'string' && ALLOWED_APP_NAME_REGEX.test(name) && name.length <= 100;
}

/**
 * GET /apps
 * Returns PM2 process list as JSON
 */
const listApps = async (req, res) => {
  try {
    const { stdout } = await safeExec('pm2', ['jlist']);
    console.log("stdout")
    let apps = [];

    try {
      const raw = JSON.parse(stdout);
      console.log(raw)
      apps = raw.map(app => ({
        pid: app.pid,
        name: app.name,
        pmId: app.pm_id,
        status: app.pm2_env?.status || 'unknown',
        cpu: app.monit?.cpu || 0,
        memory: app.monit?.memory || 0,
        uptime: app.pm2_env?.pm_uptime || null,
        restarts: app.pm2_env?.restart_time || 0,
        version: app.pm2_env?.version || null,
        mode: app.pm2_env?.exec_mode || 'fork',
        instances: app.pm2_env?.instances || 1,
        watching: app.pm2_env?.watch || false,
      }));
    } catch {
      // pm2 not installed or no apps
      apps = [];
    }

    res.json({ apps });
  } catch (err) {
    console.error('List apps error:', err.message);
    // Return empty list if pm2 not available
    res.json({ apps: [], warning: 'PM2 not available or no apps running' });
  }
};

/**
 * POST /apps/restart
 * Body: { appName: string }
 */
const restartApp = async (req, res) => {
  const { appName } = req.body;

  if (!validateAppName(appName)) {
    return res.status(400).json({ error: 'Invalid app name' });
  }

  try {
    const { stdout } = await safeExec('pm2', ['restart', appName]);
    res.json({ success: true, output: stdout });
  } catch (err) {
    console.error('Restart error:', err.message);
    res.status(500).json({ error: `Failed to restart "${appName}": ${err.message}` });
  }
};

/**
 * POST /apps/stop
 * Body: { appName: string }
 */
const stopApp = async (req, res) => {
  const { appName } = req.body;

  if (!validateAppName(appName)) {
    return res.status(400).json({ error: 'Invalid app name' });
  }

  try {
    const { stdout } = await safeExec('pm2', ['stop', appName]);
    res.json({ success: true, output: stdout });
  } catch (err) {
    console.error('Stop error:', err.message);
    res.status(500).json({ error: `Failed to stop "${appName}": ${err.message}` });
  }
};

module.exports = { listApps, restartApp, stopApp };
