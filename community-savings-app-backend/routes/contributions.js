
// routes/contributions.js

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { handleValidation } = require('../utils/validators');

const {
  addContribution,
  getGroupContributions,
  getUserContributions,
  getGroupStats,
} = require('../controllers/contributionController');

const { verifyToken } = require('../middleware/auth');

/**
 * Cross-field validator to ensure `from` <= `to` when both provided.
 */
const validateFromTo = [
  query('from').optional().isISO8601().toDate(),
  query('to').optional().isISO8601().toDate(),
  query('to').custom((to, { req }) => {
    const from = req.query.from;
    if (from && to && new Date(from) > new Date(to)) {
      throw new Error('`from` must be earlier than or equal to `to`');
    }
    return true;
  }),
];

/**
 * @route   POST /api/contributions
 * @desc    Add a new contribution
 * @access  Private (Authenticated Users)
 * @body    { amount: number, groupId: string (ObjectId), note?: string, date?: ISO8601 }
 */
router.post(
  '/',
  verifyToken,
  [
    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be > 0')
      .toFloat(),
    body('groupId').isMongoId().withMessage('groupId must be a valid ObjectId'),
    body('note').optional().isString().trim().isLength({ max: 1000 }),
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
  ],
  handleValidation,
  asyncHandler(addContribution)
);

/**
 * @route   GET /api/contributions/group/:groupId
 * @desc    Get all contributions for a specific group (paginated)
 * @access  Private (Authenticated Users)
 * @query   ?page=1&limit=50&from=<ISO8601>&to=<ISO8601>
 */
router.get(
  '/group/:groupId',
  verifyToken,
  [
    param('groupId').isMongoId().withMessage('groupId must be a valid ObjectId'),
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    ...validateFromTo,
  ],
  handleValidation,
  asyncHandler(getGroupContributions)
);

/**
 * @route   GET /api/contributions/group/:groupId/stats
 * @desc    Get statistics for a group (optional date range)
 * @access  Private (Authenticated Users)
 * @query   ?from=<ISO8601>&to=<ISO8601>
 */
router.get(
  '/group/:groupId/stats',
  verifyToken,
  [
    param('groupId').isMongoId().withMessage('groupId must be a valid ObjectId'),
    ...validateFromTo,
  ],
  handleValidation,
  asyncHandler(getGroupStats)
);

/**
 * @route   GET /api/contributions/user
 * @desc    Get all contributions made by the logged-in user (paginated)
 * @access  Private (Authenticated Users)
 */
router.get(
  '/user',
  verifyToken,
  [
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    ...validateFromTo,
  ],
  handleValidation,
  asyncHandler(getUserContributions)
);

module.exports = router;
