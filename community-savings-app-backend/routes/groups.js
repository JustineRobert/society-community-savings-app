// routes/groups.js

const express = require('express');
const router = express.Router();

const {
  createGroup,
  joinGroup,
  getGroups,
  seedGroups,
} = require('../controllers/groupController');

const { verifyToken } = require('../middleware/auth');

/**
 * @route   POST /api/groups
 * @desc    Create a new savings group
 * @access  Private (Authenticated Users)
 */
router.post('/', verifyToken, createGroup);

/**
 * @route   POST /api/groups/join/:id
 * @desc    Join an existing group by ID
 * @access  Private (Authenticated Users)
 */
router.post('/join/:id', verifyToken, joinGroup);

/**
 * @route   GET /api/groups
 * @desc    Get all groups associated with the authenticated user
 * @access  Private (Authenticated Users)
 */
router.get('/', verifyToken, getGroups);

/**
 * @route   POST /api/groups/seed
 * @desc    Seed sample groups for local development (disabled in production)
 * @access  Private (Authenticated Users)
 */
router.post('/seed', verifyToken, seedGroups);

module.exports = router;
