const express = require('express');
const router = express.Router();
const { listApps, restartApp, stopApp } = require('../controllers/appsController');

router.get('/', listApps);
router.post('/restart', restartApp);
router.post('/stop', stopApp);

module.exports = router;
