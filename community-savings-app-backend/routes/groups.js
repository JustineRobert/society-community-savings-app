
// routes/groups.js
// ============================================================================
// Group Routes — create, join, list, seed
// - Uses shared verifyToken for authentication.
// - Validates inputs via centralized validators.
// - Wraps controllers with asyncHandler to forward errors.
// ============================================================================

const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { validationRules, handleValidation } = require('../utils/validators');

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
router.post(
  '/',
  verifyToken,
  validationRules.createGroup,
  handleValidation,
  asyncHandler(createGroup)
);

/**
 * @route   POST /api/groups/join/:id
 * @desc    Join an existing group by ID
 * @access  Private (Authenticated Users)
 */
router.post(
  '/join/:id',
  verifyToken,
  [param('id').isMongoId().withMessage('Invalid group ID')],
  handleValidation,
  asyncHandler(joinGroup)
);

/**
 * @route   GET /api/groups
 * @desc    Get all groups associated with the authenticated user
 * @access  Private (Authenticated Users)
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(getGroups)
);

/**
 * @route   POST /api/groups/seed
 * @desc    Seed sample groups for local development (disabled in production)
 * @access  Private (Authenticated Users)
 */
router.post(
  '/seed',
  verifyToken,
  asyncHandler(seedGroups)
);

module.exports = router;
