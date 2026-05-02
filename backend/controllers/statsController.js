const Server = require('../models/Server');
const agentService = require('../services/agentService');

/**
 * GET /api/servers/:id/status
 */
const getServerStats = async (req, res) => {
  try {
    const server = await Server.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).select('+apiKey');

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const stats = await agentService.getServerStatus(server, server.apiKey);

    // Update last seen
    await Server.findByIdAndUpdate(server._id, {
      status: 'online',
      lastSeen: new Date(),
    });

    res.json({ stats });
  } catch (err) {
    // Mark server offline if agent unreachable
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.response?.status === 401) {
      await Server.findByIdAndUpdate(req.params.id, { status: 'offline' });
    }

    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Agent rejected API key. Please check your key.' });
    }

    console.error('Get stats error:', err.message);
    res.status(503).json({ error: 'Agent unreachable. Is the agent running?' });
  }
};

module.exports = { getServerStats };
