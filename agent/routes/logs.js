const express = require('express');
const router = express.Router();
const { streamLogs } = require('../controllers/logsController');

router.get('/stream', streamLogs);

module.exports = router;
