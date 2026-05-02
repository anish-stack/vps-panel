const Server = require('../models/Server');
const agentService = require('../services/agentService');

const ALLOWED_APP_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

function validateAppName(appName) {
  if (!appName || typeof appName !== 'string') return false;
  if (appName.length > 100) return false;
  return ALLOWED_APP_NAME_REGEX.test(appName);
}

async function getServerWithKey(serverId, userId) {
  const server = await Server.findOne({
    _id: serverId,
    owner: userId,
  }).select('+apiKey');
  return server;
}

/**
 * GET /api/servers/:id/apps
 */
const listApps = async (req, res) => {
  try {
    const server = await getServerWithKey(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const apps = await agentService.getApps(server, server.apiKey);
    res.json({ apps });
  } catch (err) {
    console.error('List apps error:', err.message);
    res.status(503).json({ error: 'Failed to fetch apps from agent' });
  }
};

/**
 * POST /api/servers/:id/apps/restart
 */
const restartApp = async (req, res) => {
  try {
    const { appName } = req.body;

    if (!validateAppName(appName)) {
      return res.status(400).json({ error: 'Invalid app name' });
    }

    const server = await getServerWithKey(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const result = await agentService.restartApp(server, server.apiKey, appName);
    res.json({ message: `App "${appName}" restarted`, result });
  } catch (err) {
    console.error('Restart app error:', err.message);
    if (err.response?.data) {
      return res.status(err.response.status || 500).json(err.response.data);
    }
    res.status(503).json({ error: 'Failed to restart app' });
  }
};

/**
 * POST /api/servers/:id/apps/stop
 */
const stopApp = async (req, res) => {
  try {
    const { appName } = req.body;

    if (!validateAppName(appName)) {
      return res.status(400).json({ error: 'Invalid app name' });
    }

    const server = await getServerWithKey(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const result = await agentService.stopApp(server, server.apiKey, appName);
    res.json({ message: `App "${appName}" stopped`, result });
  } catch (err) {
    console.error('Stop app error:', err.message);
    if (err.response?.data) {
      return res.status(err.response.status || 500).json(err.response.data);
    }
    res.status(503).json({ error: 'Failed to stop app' });
  }
};

module.exports = { listApps, restartApp, stopApp };
