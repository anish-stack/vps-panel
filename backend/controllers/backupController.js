const Server = require('../models/Server');
const agentService = require('../services/agentService');

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_\-\.]+\.gz$/;

async function getServerWithKey(serverId, userId) {
  return Server.findOne({ _id: serverId, owner: userId }).select('+apiKey');
}

/**
 * POST /api/servers/:id/backup
 */
const triggerBackup = async (req, res) => {
  try {
    const server = await getServerWithKey(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const { database } = req.body;
    const result = await agentService.triggerBackup(server, server.apiKey, { database });

    res.json({ message: 'Backup triggered successfully', result });
  } catch (err) {
    console.error('Trigger backup error:', err.message);
    if (err.response?.data) {
      return res.status(err.response.status || 500).json(err.response.data);
    }
    res.status(503).json({ error: 'Failed to trigger backup' });
  }
};

/**
 * GET /api/servers/:id/backups
 */
const listBackups = async (req, res) => {
  try {
    const server = await getServerWithKey(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const backups = await agentService.listBackups(server, server.apiKey);
    res.json({ backups });
  } catch (err) {
    console.error('List backups error:', err.message);
    res.status(503).json({ error: 'Failed to fetch backups' });
  }
};

/**
 * GET /api/servers/:id/backups/:filename/download
 */
const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename - prevent path traversal
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const server = await getServerWithKey(req.params.id, req.user._id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const agentResponse = await agentService.downloadBackup(server, server.apiKey, filename);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');

    if (agentResponse.headers['content-length']) {
      res.setHeader('Content-Length', agentResponse.headers['content-length']);
    }

    agentResponse.data.pipe(res);
  } catch (err) {
    console.error('Download backup error:', err.message);
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    res.status(503).json({ error: 'Failed to download backup' });
  }
};

module.exports = { triggerBackup, listBackups, downloadBackup };
