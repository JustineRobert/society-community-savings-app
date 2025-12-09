// routes/contributions.js

const express = require('express');
const router = express.Router();

const {
  addContribution,
  getGroupContributions,
  getUserContributions,
} = require('../controllers/contributionController');

const { verifyToken } = require('../middleware/auth');

/**
 * @route   POST /api/contributions
 * @desc    Add a new contribution
 * @access  Private (Authenticated Users)
 */
router.post('/', verifyToken, addContribution);

/**
 * @route   GET /api/contributions/group/:groupId
 * @desc    Get all contributions for a specific group
 * @access  Private (Authenticated Users)
 */
router.get('/group/:groupId', verifyToken, getGroupContributions);

/**
 * @route   GET /api/contributions/user
 * @desc    Get all contributions made by the logged-in user
 * @access  Private (Authenticated Users)
 */
router.get('/user', verifyToken, getUserContributions);

module.exports = router;
