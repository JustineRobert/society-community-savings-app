
// routes/settings.js

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

const { body } = require('express-validator');
const { handleValidation } = require('../utils/validators');

// Controllers
const settingsController = require('../controllers/settingsController');

// Middleware
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/settings
 * @desc    Retrieve application settings
 * @access  Public (Consider toggling to Private/Admin later)
 * @notes   Controller should avoid exposing secrets.
 */
router.get('/', asyncHandler(settingsController.getSettings));

/**
 * @route   PUT /api/settings
 * @desc    Update application settings
 * @access  Private/Admin only
 * @body    Accepts a controlled object; controller must whitelist keys.
 */
router.put(
  '/',
  verifyToken,
  isAdmin,
  [
    // Example validations; adjust to your settings schema
    body().custom(v => typeof v === 'object' && v !== null).withMessage('payload must be an object'),
    body('siteName').optional().isString().trim().isLength({ max: 255 }),
    body('supportEmail').optional().isEmail(),
    body('features').optional().isObject(),
    body('features.directMessaging').optional().isBoolean(),
    body('features.loans').optional().isBoolean(),
  ],
  handleValidation,
  asyncHandler(settingsController.updateSettings)
);

module.exports = router;
