const jwt = require('jsonwebtoken');
const axios = require('axios');
const Server = require('../models/Server');

const ALLOWED_APP_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

// Track active log streams: socketId -> AbortController
const activeStreams = new Map();

module.exports = function initSocketHandlers(io) {
  // Auth middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    /**
     * Start streaming logs from agent
     * Emits: log_line, log_error, log_end
     */
    socket.on('subscribe_logs', async ({ serverId, appName, lines = 100 }) => {
      try {
        // Validate appName
        if (appName && !ALLOWED_APP_NAME_REGEX.test(appName)) {
          socket.emit('log_error', { message: 'Invalid app name' });
          return;
        }

        // Get server and verify ownership
        const server = await Server.findOne({
          _id: serverId,
          owner: socket.userId,
        }).select('+apiKey');

        if (!server) {
          socket.emit('log_error', { message: 'Server not found or access denied' });
          return;
        }

        // Cancel any existing stream for this socket
        if (activeStreams.has(socket.id)) {
          activeStreams.get(socket.id).abort();
          activeStreams.delete(socket.id);
        }

        const controller = new AbortController();
        activeStreams.set(socket.id, controller);

        const protocol = 'http';
        const agentUrl = `${protocol}://${server.ip}:${server.port || 7001}`;
        const params = new URLSearchParams({ lines });
        if (appName) params.append('appName', appName);

        socket.emit('log_start', { serverId, appName });

        const response = await axios.get(`${agentUrl}/logs/stream?${params}`, {
          headers: { 'X-API-Key': server.apiKey },
          responseType: 'stream',
          signal: controller.signal,
          timeout: 0, // No timeout for streaming
        });

        const stream = response.data;

        stream.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(l => l.trim());
          lines.forEach(line => {
            // SSE format: "data: {...}\n"
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6));
                socket.emit('log_line', payload);
              } catch {
                socket.emit('log_line', { message: line.slice(6), timestamp: new Date().toISOString() });
              }
            }
          });
        });

        stream.on('error', (err) => {
          if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
            socket.emit('log_error', { message: 'Log stream error: ' + err.message });
          }
          activeStreams.delete(socket.id);
        });

        stream.on('end', () => {
          socket.emit('log_end', { message: 'Log stream ended' });
          activeStreams.delete(socket.id);
        });

      } catch (err) {
        if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          console.error('Socket subscribe_logs error:', err.message);
          socket.emit('log_error', { message: 'Failed to connect to agent log stream' });
        }
        activeStreams.delete(socket.id);
      }
    });

    /**
     * Stop log stream
     */
    socket.on('unsubscribe_logs', () => {
      if (activeStreams.has(socket.id)) {
        activeStreams.get(socket.id).abort();
        activeStreams.delete(socket.id);
        socket.emit('log_end', { message: 'Unsubscribed from logs' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (activeStreams.has(socket.id)) {
        activeStreams.get(socket.id).abort();
        activeStreams.delete(socket.id);
      }
    });
  });
};
