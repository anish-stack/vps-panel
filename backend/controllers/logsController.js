const Server = require('../models/Server');
const { getAgentBaseUrl } = require('../services/agentService');

const ALLOWED_APP_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

/**
 * GET /api/servers/:id/logs/stream-url
 * Returns the agent logs websocket/SSE URL for frontend to connect directly
 * (via backend proxy to keep API key hidden)
 */
const getLogsStreamInfo = async (req, res) => {
  try {
    const { appName } = req.query;

    if (appName && !ALLOWED_APP_NAME_REGEX.test(appName)) {
      return res.status(400).json({ error: 'Invalid app name' });
    }

    const server = await Server.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).select('+apiKey');

    if (!server) return res.status(404).json({ error: 'Server not found' });

    // Return connection info - socket.io will use this
    res.json({
      serverId: server._id,
      serverName: server.name,
      agentUrl: getAgentBaseUrl(server),
      appName: appName || null,
    });
  } catch (err) {
    console.error('Logs stream info error:', err);
    res.status(500).json({ error: 'Failed to get log stream info' });
  }
};

module.exports = { getLogsStreamInfo };
