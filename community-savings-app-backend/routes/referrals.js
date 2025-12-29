
// routes/referrals.js

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

const { body, query } = require('express-validator');
const { handleValidation } = require('../utils/validators');

// Middleware
const { verifyToken } = require('../middleware/auth');

// Controllers
const {
  createReferral,
  getUserReferrals
} = require('../controllers/referralController');

/**
 * @route   POST /api/referrals
 * @desc    Create a new referral for the logged-in user
 * @access  Private (Authenticated Users)
 * @body    { email: string, name?: string, phone?: string, note?: string }
 */
router.post(
  '/',
  verifyToken,
  [
    body('email').isEmail().withMessage('valid email is required'),
    body('name').optional().isString().trim().isLength({ max: 255 }),
    body('phone').optional().isString().trim().isLength({ max: 30 }),
    body('note').optional().isString().trim().isLength({ max: 1000 }),
  ],
  handleValidation,
  asyncHandler(createReferral)
);

/**
 * @route   GET /api/referrals
 * @desc    Retrieve all referrals made by the logged-in user (paginated)
 * @access  Private (Authenticated Users)
 * @query   ?page=1&limit=50
 */
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
  ],
  handleValidation,
  asyncHandler(getUserReferrals)
);

module.exports = router;
