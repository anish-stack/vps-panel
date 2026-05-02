const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { listApps, restartApp, stopApp } = require('../controllers/appsController');

router.get('/:id/apps', authenticate, listApps);
router.post('/:id/apps/restart', authenticate, restartApp);
router.post('/:id/apps/stop', authenticate, stopApp);

module.exports = router;
