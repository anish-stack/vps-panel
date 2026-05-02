const { safeSpawn } = require('../utils/shell');

const ALLOWED_APP_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

/**
 * GET /logs/stream?appName=myapp&lines=100
 * Server-Sent Events stream of PM2 logs
 */
const streamLogs = (req, res) => {
  const { appName, lines = '100' } = req.query;

  if (appName && !ALLOWED_APP_NAME_REGEX.test(appName)) {
    return res.status(400).json({ error: 'Invalid app name' });
  }

  // Validate lines is a safe number
  const numLines = Math.min(parseInt(lines) || 100, 1000);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();

  const sendEvent = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Build PM2 log args
  const args = ['logs'];
  if (appName) {
    args.push(appName);
  }
  args.push('--lines', String(numLines), '--nostream', '--timestamp');

  let pm2Process;

  try {
    pm2Process = safeSpawn('pm2', args);
  } catch (err) {
    sendEvent({ message: `Error: ${err.message}`, type: 'error', timestamp: new Date().toISOString() });
    res.end();
    return;
  }

  const processLine = (line, type = 'stdout') => {
    if (!line.trim()) return;
    sendEvent({
      message: line,
      type,
      timestamp: new Date().toISOString(),
      appName: appName || 'all',
    });
  };

  pm2Process.stdout.on('data', (chunk) => {
    chunk.toString().split('\n').forEach(line => processLine(line, 'stdout'));
  });

  pm2Process.stderr.on('data', (chunk) => {
    chunk.toString().split('\n').forEach(line => processLine(line, 'stderr'));
  });

  pm2Process.on('close', (code) => {
    sendEvent({ message: `[Process ended with code ${code}]`, type: 'system', timestamp: new Date().toISOString() });
    if (!res.writableEnded) res.end();
  });

  pm2Process.on('error', (err) => {
    sendEvent({ message: `Error: ${err.message}`, type: 'error', timestamp: new Date().toISOString() });
    if (!res.writableEnded) res.end();
  });

  // Now stream live logs (--follow mode after initial dump)
  // Start a separate follow process
  let followProcess;
  try {
    const followArgs = ['logs'];
    if (appName) followArgs.push(appName);
    followArgs.push('--lines', '0'); // No history, just live

    followProcess = safeSpawn('pm2', followArgs);

    followProcess.stdout.on('data', (chunk) => {
      chunk.toString().split('\n').forEach(line => processLine(line, 'stdout'));
    });

    followProcess.stderr.on('data', (chunk) => {
      chunk.toString().split('\n').forEach(line => processLine(line, 'stderr'));
    });

    followProcess.on('error', () => {}); // Ignore follow errors silently
  } catch {
    // Follow not available, that's OK
  }

  // Keepalive ping every 15 seconds
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':keepalive\n\n');
    } else {
      clearInterval(keepAlive);
    }
  }, 15000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    try { pm2Process?.kill(); } catch {}
    try { followProcess?.kill(); } catch {}
    if (!res.writableEnded) res.end();
  });
};

module.exports = { streamLogs };
