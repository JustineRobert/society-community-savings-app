const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const requireAuth = require('../middleware/requireAuth');

// POST /api/kyc/verify
router.post('/verify', requireAuth, kycController.verifyUser);

module.exports = router;
