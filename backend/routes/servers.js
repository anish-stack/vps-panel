const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createServer,
  listServers,
  getServer,
  updateServer,
  deleteServer,
  regenerateApiKey,
  pingServer,
} = require('../controllers/serverController');

router.use(authenticate);

router.route('/')
  .get(listServers)
  .post(createServer);

router.route('/:id')
  .get(getServer)
  .patch(updateServer)
  .delete(deleteServer);

router.post('/:id/regenerate-key', regenerateApiKey);
router.post('/:id/ping', pingServer);

module.exports = router;
