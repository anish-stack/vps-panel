const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getServerStats } = require('../controllers/statsController');

router.get('/:id/status', authenticate, getServerStats);

module.exports = router;
