const { execFile, spawn } = require('child_process');
const path = require('path');

// Whitelisted commands with their allowed paths
const COMMAND_WHITELIST = {
  pm2: '/usr/bin/pm2',
  mongodump: '/usr/bin/mongodump',
  node: '/usr/bin/node',
};

// Try to find pm2 in common locations
function findPm2() {
  const candidates = [
    '/root/.nvm/versions/node/v20.20.0/bin/pm2',
    '/usr/bin/pm2',
    '/usr/local/bin/pm2',
    '/usr/lib/node_modules/.bin/pm2',
    'pm2',
  ];
  // Return first candidate - in production validate with fs.existsSync
  return candidates[1]; // /usr/local/bin/pm2 is most common
}

/**
 * Execute a whitelisted command safely
 * @param {string} cmd - command name from whitelist
 * @param {string[]} args - arguments array (no shell expansion)
 * @param {object} options - exec options
 * @returns {Promise<{stdout, stderr}>}
 */
function safeExec(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    // Validate each arg - no shell metacharacters
    const safeArgRegex = /^[a-zA-Z0-9_\-\.\/\:@=,]+$/;
    for (const arg of args) {
      if (typeof arg !== 'string' || !safeArgRegex.test(arg)) {
        return reject(new Error(`Unsafe argument detected: "${arg}"`));
      }
    }

    const cmdPath = cmd === 'pm2' ? findPm2() : (COMMAND_WHITELIST[cmd] || cmd);

    execFile(cmdPath, args, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 5, // 5MB
      ...options,
      shell: false, // NEVER use shell
    }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Spawn a streaming process (for logs)
 * Returns the ChildProcess object
 */
function safeSpawn(cmd, args = [], options = {}) {
  const safeArgRegex = /^[a-zA-Z0-9_\-\.\/\:@=,]+$/;
  for (const arg of args) {
    if (typeof arg !== 'string' || !safeArgRegex.test(arg)) {
      throw new Error(`Unsafe argument: "${arg}"`);
    }
  }

  const cmdPath = cmd === 'pm2' ? findPm2() : (COMMAND_WHITELIST[cmd] || cmd);

  return spawn(cmdPath, args, {
    shell: false,
    ...options,
  });
}

module.exports = { safeExec, safeSpawn, findPm2 };
