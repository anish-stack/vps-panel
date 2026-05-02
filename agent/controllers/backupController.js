const fs = require('fs');
const path = require('path');
const { safeExec } = require('../utils/shell');

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_\-\.]+\.gz$/;
const DB_NAME_REGEX = /^[a-zA-Z0-9_\-]+$/;

function getBackupDir() {
  const dir = process.env.BACKUP_DIR || '/var/backups/mongodb';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

/**
 * POST /backups
 * Trigger mongodump backup
 */
const triggerBackup = async (req, res) => {
  try {
    const { database } = req.body;

    if (database && !DB_NAME_REGEX.test(database)) {
      return res.status(400).json({ error: 'Invalid database name' });
    }

    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dbPart = database || 'all';
    const filename = `backup-${dbPart}-${timestamp}.gz`;
    const outPath = path.join(backupDir, filename);

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const args = ['--uri', mongoUri, '--gzip', '--archive', outPath];

    // if (database) {
    //   args.push('--db', database);
    // }

    await safeExec('mongodump', args);

    // Get file size
    const stat = fs.statSync(outPath);

    res.json({
      success: true,
      filename,
      size: stat.size,
      path: outPath,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Backup error:', err.message);
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
};

/**
 * GET /backups
 * List available backups
 */
const listBackups = (req, res) => {
  try {
    const backupDir = getBackupDir();

    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.gz'))
      .map(filename => {
        const stat = fs.statSync(path.join(backupDir, filename));
        return {
          filename,
          size: stat.size,
          createdAt: stat.birthtime || stat.mtime,
          modifiedAt: stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50); // Max 50 backups listed

    res.json({ backups: files });
  } catch (err) {
    console.error('List backups error:', err.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
};

/**
 * GET /backups/:filename/download
 * Stream backup file download
 */
const downloadBackup = (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const backupDir = getBackupDir();

    // Resolve and check path is within backup dir (prevent traversal)
    const filePath = path.resolve(backupDir, filename);
    if (!filePath.startsWith(path.resolve(backupDir))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', stat.size);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('Download stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });
  } catch (err) {
    console.error('Download backup error:', err.message);
    res.status(500).json({ error: 'Download failed' });
  }
};

module.exports = { triggerBackup, listBackups, downloadBackup };