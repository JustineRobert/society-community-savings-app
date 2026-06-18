'use strict';

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const {
  createConversationValidator,
  sendMessageValidator,
  editMessageValidator,
} = require('../validators/chatValidator');
const { verifyToken, requireRole } = require('../middlewares/auth'); // JWT + role middleware
const asyncHandler = require('../utils/asyncHandler'); // centralized async error wrapper

// --- Guardrails: verify controllers are functions at load time
const controllers = {
  createConversation: chatController.createConversation,
  listConversations: chatController.listConversations,
  getConversationById: chatController.getConversationById,
  getConversationMessages: chatController.getConversationMessages,
  sendMessage: chatController.sendMessage,
  editMessage: chatController.editMessage,
  deleteMessageSoft: chatController.deleteMessageSoft,
  searchMessages: chatController.searchMessages,
  pinMessage: chatController.pinMessage,
  archiveConversation: chatController.archiveConversation,
};
for (const [key, val] of Object.entries(controllers)) {
  if (val !== undefined && typeof val !== 'function') {
    throw new TypeError(`[routes/chat] Controller "${key}" must be a function, received: ${typeof val}`);
  }
}

// All routes require authentication
router.use(verifyToken);

// Conversation routes
router.post(
  '/conversation',
  createConversationValidator,
  asyncHandler(chatController.createConversation)
);
router.get('/conversations', asyncHandler(chatController.listConversations));
router.get('/conversation/:id', asyncHandler(chatController.getConversationById));
router.get('/conversation/:id/messages', asyncHandler(chatController.getConversationMessages));
router.post(
  '/conversation/:conversationId/pin/:messageId',
  requireRole('ADMIN'),
  asyncHandler(chatController.pinMessage)
);
router.post(
  '/conversation/:id/archive',
  requireRole('ADMIN', 'SUPPORT'),
  asyncHandler(chatController.archiveConversation)
);

// Message routes
router.post('/message', sendMessageValidator, asyncHandler(chatController.sendMessage));
router.put('/message/:id', editMessageValidator, asyncHandler(chatController.editMessage));
router.delete('/message/:id', asyncHandler(chatController.deleteMessageSoft));

// Search
router.get('/messages/search', asyncHandler(chatController.searchMessages));

module.exports = router;
