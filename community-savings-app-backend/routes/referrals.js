// routes/referrals.js

const express = require('express');
const router = express.Router();

// Middleware to verify authentication
const { verifyToken } = require('../middleware/auth');

// Referral controller handlers
const {
  createReferral,
  getUserReferrals
} = require('../controllers/referralController');

/**
 * @route   POST /api/referrals
 * @desc    Create a new referral for the logged-in user
 * @access  Private (Authenticated Users)
 */
router.post('/', verifyToken, createReferral);

/**
 * @route   GET /api/referrals
 * @desc    Retrieve all referrals made by the logged-in user
 * @access  Private (Authenticated Users)
 */
router.get('/', verifyToken, getUserReferrals);

module.exports = router;
