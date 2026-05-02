const Server = require('../models/Server');
const { pingAgent } = require('../services/agentService');

/**
 * POST /api/servers
 */
const createServer = async (req, res) => {
  try {
    const { name, ip, port, description, tags } = req.body;

    if (!name || !ip) {
      return res.status(400).json({ error: 'Name and IP are required' });
    }

    // Generate API key
    const { rawKey, prefix, hash } = Server.generateApiKey();

    const server = await Server.create({
      owner: req.user._id,
      name,
      ip,
      port: port || 7001,
      description,
      tags: tags || [],
      apiKey: rawKey,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    });

    // Return the raw key ONCE (user must save it)
    res.status(201).json({
      message: 'Server added successfully',
      server: {
        _id: server._id,
        name: server.name,
        ip: server.ip,
        port: server.port,
        status: server.status,
        description: server.description,
        tags: server.tags,
        apiKeyPrefix: server.apiKeyPrefix,
        createdAt: server.createdAt,
      },
      // Show once only
      apiKey: rawKey,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A server with this IP already exists' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Create server error:', err);
    res.status(500).json({ error: 'Failed to create server' });
  }
};

/**
 * GET /api/servers
 */
const listServers = async (req, res) => {
  try {
    const servers = await Server.find({ owner: req.user._id })
      .select('-apiKey -apiKeyHash')
      .sort('-createdAt');

    res.json({ servers });
  } catch (err) {
    console.error('List servers error:', err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
};

/**
 * GET /api/servers/:id
 */
const getServer = async (req, res) => {
  try {
    const server = await Server.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).select('-apiKey -apiKeyHash');

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ server });
  } catch (err) {
    console.error('Get server error:', err);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
};

/**
 * PATCH /api/servers/:id
 */
const updateServer = async (req, res) => {
  try {
    const { name, description, tags, port } = req.body;
    const allowed = {};
    if (name) allowed.name = name;
    if (description !== undefined) allowed.description = description;
    if (tags) allowed.tags = tags;
    if (port) allowed.port = port;

    const server = await Server.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      allowed,
      { new: true, runValidators: true }
    ).select('-apiKey -apiKeyHash');

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ server });
  } catch (err) {
    console.error('Update server error:', err);
    res.status(500).json({ error: 'Failed to update server' });
  }
};

/**
 * DELETE /api/servers/:id
 */
const deleteServer = async (req, res) => {
  try {
    const server = await Server.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ message: 'Server removed successfully' });
  } catch (err) {
    console.error('Delete server error:', err);
    res.status(500).json({ error: 'Failed to delete server' });
  }
};

/**
 * POST /api/servers/:id/regenerate-key
 */
const regenerateApiKey = async (req, res) => {
  try {
    const { rawKey, prefix, hash } = Server.generateApiKey();

    const server = await Server.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { apiKey: rawKey, apiKeyPrefix: prefix, apiKeyHash: hash },
      { new: true }
    ).select('-apiKeyHash');

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({
      message: 'API key regenerated. Update your agent configuration.',
      apiKey: rawKey,
      apiKeyPrefix: prefix,
    });
  } catch (err) {
    console.error('Regenerate key error:', err);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
};

/**
 * POST /api/servers/:id/ping
 */
const pingServer = async (req, res) => {
  try {
    const server = await Server.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).select('+apiKey');

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const isOnline = await pingAgent(server, server.apiKey);
    const status = isOnline ? 'online' : 'offline';

    await Server.findByIdAndUpdate(server._id, {
      status,
      lastSeen: isOnline ? new Date() : server.lastSeen,
    });

    res.json({ status, lastSeen: isOnline ? new Date() : server.lastSeen });
  } catch (err) {
    console.error('Ping error:', err);
    res.status(500).json({ error: 'Ping failed' });
  }
};

module.exports = {
  createServer,
  listServers,
  getServer,
  updateServer,
  deleteServer,
  regenerateApiKey,
  pingServer,
};
