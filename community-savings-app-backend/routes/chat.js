
// routes/chat.js

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

const { body, param, query } = require('express-validator');
const { handleValidation } = require('../utils/validators');

// AuthZ middleware
const { verifyToken, requireRole } = require('../middleware/auth');

// Controllers (some may be optional)
const {
  sendMessage,
  getGroupMessages,
  getUserMessages,   // Optional: for private/user-to-user messaging
  deleteMessage      // Optional: for admin/moderator cleanup
} = require('../controllers/chatController');

// --- Guardrails: verify controllers are functions at load time (if provided).
const controllers = { sendMessage, getGroupMessages, getUserMessages, deleteMessage };
for (const [key, val] of Object.entries(controllers)) {
  if (val !== undefined && typeof val !== 'function') {
    throw new TypeError(`[routes/chat] Controller "${key}" must be a function, received: ${typeof val}`);
  }
}

/**
 * @route   POST /api/chat
 * @desc    Send a message to a group
 * @access  Private (Authenticated Users)
 * @notes   Enforces minimal payload shape; controllers also normalize/sanitize content.
 */
router.post(
  '/',
  verifyToken,
  [
    body('groupId').isString().trim().notEmpty().withMessage('groupId is required'),
    body('content').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('content is required (1-5000 chars)'),
    body('attachments').optional().isArray().withMessage('attachments must be an array'),
  ],
  handleValidation,
  asyncHandler(sendMessage)
);

/**
 * @route   GET /api/chat/group/:groupId
 * @desc    Retrieve messages in a specific group (paginated)
 * @access  Private (Authenticated Users)
 * @query   ?page=1&limit=50&before=<ISO8601>&after=<ISO8601>
 */
router.get(
  '/group/:groupId',
  verifyToken,
  [
    param('groupId').isString().trim().notEmpty(),
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    query('before').optional().isISO8601().withMessage('before must be ISO date'),
    query('after').optional().isISO8601().withMessage('after must be ISO date'),
  ],
  handleValidation,
  asyncHandler(getGroupMessages)
);

/**
 * @route   GET /api/chat/user/:userId
 * @desc    Retrieve direct messages with a specific user (paginated)
 * @access  Private (Optional Direct Messaging Feature)
 * @query   ?page=1&limit=50
 */
if (typeof getUserMessages === 'function') {
  router.get(
    '/user/:userId',
    verifyToken,
    [
      param('userId').isString().trim().notEmpty(),
      query('page').optional().toInt().isInt({ min: 1 }),
      query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    ],
    handleValidation,
    asyncHandler(getUserMessages)
  );
}

/**
 * @route   DELETE /api/chat/:messageId
 * @desc    Delete a specific message by its ID
 * @access  Private (Admin/Moderator Only)
 * @notes   Controller may further enforce ownership if needed.
 */
if (typeof deleteMessage === 'function') {
  router.delete(
    '/:messageId',
    verifyToken,
    requireRole('admin', 'group_admin'),
    [param('messageId').isString().trim().notEmpty()],
    handleValidation,
    asyncHandler(deleteMessage)
  );
}

module.exports = router;
