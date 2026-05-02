const axios = require('axios');

const AGENT_TIMEOUT = parseInt(process.env.AGENT_TIMEOUT) || 10000;

/**
 * Build base URL for agent
 */
function getAgentBaseUrl(server) {
  const protocol = 'http'; // Use https in production with proper certs
  return `${protocol}://${server.ip}:${server.port || 7001}`;
}

/**
 * Create axios instance for a specific server
 */
function createAgentClient(server, rawApiKey) {
  return axios.create({
    baseURL: getAgentBaseUrl(server),
    timeout: AGENT_TIMEOUT,
    headers: {
      'X-API-Key': rawApiKey,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get server status (CPU, RAM, Disk, uptime)
 */
async function getServerStatus(server, rawApiKey) {
  const client = createAgentClient(server, rawApiKey);
  const { data } = await client.get('/status');
  return data;
}

/**
 * Get PM2 app list
 */
async function getApps(server, rawApiKey) {
  const client = createAgentClient(server, rawApiKey);
  const { data } = await client.get('/apps');
  return data;
}

/**
 * Restart a PM2 app
 */
async function restartApp(server, rawApiKey, appName) {
  const client = createAgentClient(server, rawApiKey);
  const { data } = await client.post('/restart-app', { appName });
  return data;
}

/**
 * Stop a PM2 app
 */
async function stopApp(server, rawApiKey, appName) {
  const client = createAgentClient(server, rawApiKey);
  const { data } = await client.post('/stop-app', { appName });
  return data;
}

/**
 * Trigger MongoDB backup
 */
async function triggerBackup(server, rawApiKey, options = {}) {
  const client = createAgentClient(server, rawApiKey);
  const { data } = await client.post('/backup', options);
  return data;
}

/**
 * List available backups
 */
async function listBackups(server, rawApiKey) {
  const client = createAgentClient(server, rawApiKey);
  const { data } = await client.get('/backups');
  return data;
}

/**
 * Get download stream for a backup file
 */
async function downloadBackup(server, rawApiKey, filename) {
  const client = createAgentClient(server, rawApiKey);
  const response = await client.get(`/backups/${encodeURIComponent(filename)}/download`, {
    responseType: 'stream',
    timeout: 60000, // 60s for large files
  });
  return response;
}

/**
 * Ping agent - check connectivity
 */
async function pingAgent(server, rawApiKey) {
  try {
    const client = createAgentClient(server, rawApiKey);
    await client.get('/ping', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getServerStatus,
  getApps,
  restartApp,
  stopApp,
  triggerBackup,
  listBackups,
  downloadBackup,
  pingAgent,
  getAgentBaseUrl,
};
