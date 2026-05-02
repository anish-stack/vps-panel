const express = require('express');
const router = express.Router();
const { triggerBackup, listBackups, downloadBackup } = require('../controllers/backupController');

router.post('/', triggerBackup);
router.get('/', listBackups);
router.get('/:filename/download', downloadBackup);

module.exports = router;
