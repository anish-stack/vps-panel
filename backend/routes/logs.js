const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getLogsStreamInfo } = require('../controllers/logsController');

router.get('/:id/logs/info', authenticate, getLogsStreamInfo);

module.exports = router;
