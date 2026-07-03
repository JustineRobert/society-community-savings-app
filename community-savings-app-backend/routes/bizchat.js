const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const checkPermission = require('../middleware/checkPermission');
const bizchatController = require('../controllers/bizchat.controller');

// POST /api/bizchat/execute
router.post('/execute', requireAuth, bizchatController.execute);

module.exports = router;
