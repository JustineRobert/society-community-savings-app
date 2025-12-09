// routes/settings.js

const express = require('express');
const router = express.Router();

// Controllers
const settingsController = require('../controllers/settingsController');

// Middleware
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/settings
 * @desc    Retrieve application settings
 * @access  Public (consider making it Private/Admin in the future)
 */
router.get('/', settingsController.getSettings);

/**
 * @route   PUT /api/settings
 * @desc    Update application settings
 * @access  Private/Admin only
 */
router.put('/', verifyToken, isAdmin, settingsController.updateSettings);

module.exports = router;
