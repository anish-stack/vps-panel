const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { triggerBackup, listBackups, downloadBackup } = require('../controllers/backupController');

router.post('/:id/backup', authenticate, triggerBackup);
router.get('/:id/backups', authenticate, listBackups);
router.get('/:id/backups/:filename/download', authenticate, downloadBackup);

module.exports = router;
