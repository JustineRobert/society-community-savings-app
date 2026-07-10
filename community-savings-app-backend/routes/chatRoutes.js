'use strict';

/**
 * ============================================================================
 * TITechChat ROUTES (ACFOS ENTERPRISE EDITION)
 * ============================================================================
 * TITech Community Capital LTD
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Enterprise-grade routing layer for TITechChat.
 *
 * This router enforces:
 *
 * ✅ Strict RBAC (Admin / Leader / Support / Member / Auditor)
 * ✅ Conversation-bound access control (no free-form chat)
 * ✅ Attachment validation (whitelisted file types only)
 * ✅ Message sanitization (XSS protection)
 * ✅ Rate limiting (abuse prevention)
 * ✅ Entity-linked thread governance (Loan/Savings/Support/etc.)
 *
 * ARCHITECTURE RULE
 * ----------------------------------------------------------------------------
 * Routes are thin.
 * All business logic lives in controllers/services.
 *
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

/*
|--------------------------------------------------------------------------
| Controllers
|--------------------------------------------------------------------------
*/

const conversationController =
  require('../controllers/chat/conversationController');

const messageController =
  require('../controllers/chat/messageController');

const supportController =
  require('../controllers/chat/supportThreadController');

const announcementController =
  require('../controllers/chat/announcementController');

const exportController =
  require('../controllers/chat/exportController');

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

const chatAuth =
  require('../middleware/chatAuthorization');

const access =
  require('../middleware/conversationAccess');

const { requireParticipant } =
  require('../middleware/conversationAccess');

const attachmentValidation =
  require('../middleware/attachmentValidation');

const messageSanitizer =
  require('../middleware/messageSanitizer');

const chatRateLimit =
  require('../middleware/chatRateLimit');

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

router.get('/health', (req, res) => {
  res.status(200).json({
    service: 'TITechChat',
    status: 'UP',
    timestamp: new Date(),
  });
});

/*
|--------------------------------------------------------------------------
| CONVERSATIONS
|--------------------------------------------------------------------------
*/

/**
 * Create conversation (STRICTLY ENTITY-LINKED)
 */
router.post(
  '/conversations',
  chatAuth,
  chatRateLimit,
  conversationController.createConversation
);

/**
 * Get user conversations
 */
router.get(
  '/conversations',
  chatAuth,
  chatRateLimit,
  conversationController.myConversations
);

/**
 * Get single conversation
 */
router.get(
  '/conversations/:conversationId',
  chatAuth,
  requireParticipant,
  conversationController.getConversation
);

/**
 * Archive conversation
 */
router.patch(
  '/conversations/:conversationId/archive',
  chatAuth,
  requireParticipant,
  conversationController.archiveConversation
);

/**
 * Lock conversation (compliance)
 */
router.patch(
  '/conversations/:conversationId/lock',
  chatAuth,
  requireParticipant,
  conversationController.lockConversation
);

/*
|--------------------------------------------------------------------------
| MESSAGES
|--------------------------------------------------------------------------
*/

/**
 * Send message
 */
router.post(
  '/conversations/:id/messages',
  chatAuth,
  requireParticipant,
  chatRateLimit,
  messageSanitizer,
  attachmentValidation,
  messageController.sendMessage
);

/**
 * Edit message
 */
router.patch(
  '/messages/:messageId',
  chatAuth,
  messageSanitizer,
  messageController.editMessage
);

/**
 * Delete message
 */
router.delete(
  '/messages/:messageId',
  chatAuth,
  messageController.deleteMessage
);

/*
|--------------------------------------------------------------------------
| SUPPORT THREADS
|--------------------------------------------------------------------------
*/

router.post(
  '/support/threads',
  chatAuth,
  supportController.createSupportThread
);

/*
|--------------------------------------------------------------------------
| ANNOUNCEMENTS
|--------------------------------------------------------------------------
*/

router.post(
  '/announcements',
  chatAuth,
  announcementController.postAnnouncement
);

/**
 * Optional: fetch announcements
 */
router.get(
  '/announcements/:conversationId',
  chatAuth,
  announcementController.getAnnouncements
);

/*
|--------------------------------------------------------------------------
| EXPORTS / COMPLIANCE
|--------------------------------------------------------------------------
*/

router.post(
  '/conversations/:conversationId/export',
  chatAuth,
  requireParticipant,
  exportController.requestExport
);

/**
 * Get export status
 */
router.get(
  '/exports/:exportId',
  chatAuth,
  exportController.getExport
);

/**
 * List exports
 */
router.get(
  '/exports',
  chatAuth,
  exportController.listExports
);

module.exports = router;