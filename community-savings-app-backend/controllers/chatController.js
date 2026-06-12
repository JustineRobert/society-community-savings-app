/**
 * controllers/chatController.js
 *
 * HTTP handlers for chat operations using ChatService.
 * Features:
 * - Conversation management (1-to-1 DM, group conversations)
 * - Message operations (send, edit, delete with soft delete)
 * - Read receipts and unread tracking
 * - Content moderation and flagging
 * - Message search and archiving
 *
 * All operations require authentication via req.user._id
 */

const logger = require('../utils/logger');

/**
 * Helper: Ensure user is authenticated
 */
function ensureAuth(req) {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    const err = new Error('User authentication required');
    err.status = 401;
    throw err;
  }
  return userId;
}

/**
 * Helper: Create HTTP error for cleaner code
 */
function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/**
 * POST /api/chat/conversations
 * Create a new conversation (1-to-1 or group)
 *
 * Body: {
 *   type: 'dm' | 'group',
 *   participantIds: [userId],  // for DM: 1 other user; for group: other users
 *   name: string (optional, required for groups),
 *   description: string (optional)
 * }
 *
 * Returns: conversation object with participants populated
 */
exports.createConversation = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { type, participantIds, name, description } = req.body;
    const chatService = req.app.locals.chatService;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    // Validate
    if (!type || !['dm', 'group'].includes(type)) {
      throw httpError(400, 'type must be "dm" or "group"');
    }
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      throw httpError(400, 'participantIds must be non-empty array');
    }
    if (type === 'group' && !name) {
      throw httpError(400, 'name is required for group conversations');
    }

    const conversationData = {
      type,
      participantIds,
      name: name || undefined,
      description: description || undefined,
    };

    const result = await chatService.createConversation(userId, conversationData);

    logger.info('Conversation created', { conversationId: result._id, type, userId });

    res.status(201).json({
      message: 'Conversation created successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chat/conversations
 * List user's conversations (paginated, sorted by last activity)
 *
 * Query: ?page=1&limit=20
 * Returns: array of conversation objects with last message populated
 */
exports.listConversations = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const chatService = req.app.locals.chatService;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const result = await chatService.getUserConversations(userId, { skip, limit });

    res.status(200).json({
      message: 'Conversations retrieved successfully',
      data: result,
      pagination: { page, limit },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chat/conversations/:conversationId/messages
 * Get messages in a conversation (paginated, newest first)
 *
 * Query: ?page=1&limit=50
 * Returns: message array with sender populated
 */
exports.getMessages = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId } = req.params;
    const chatService = req.app.locals.chatService;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    // Verify user is participant (via getMessages with auth)
    const result = await chatService.getMessages(conversationId, userId, {
      skip,
      limit,
    });

    res.status(200).json({
      message: 'Messages retrieved successfully',
      data: result.messages,
      pagination: { page, limit, total: result.total },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Send a message to a conversation
 *
 * Body: {
 *   content: string (1-5000),
 *   replyTo: messageId (optional),
 *   attachments: array (optional)
 * }
 *
 * Returns: new message object with sender populated
 * Emits Socket.IO event: message:new (to conversation room)
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId } = req.params;
    const { content, replyTo, attachments } = req.body;
    const chatService = req.app.locals.chatService;
    const io = req.app.locals.io; // Socket.IO instance

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    // Validate
    if (!content || typeof content !== 'string') {
      throw httpError(400, 'content is required and must be string');
    }
    if (content.trim().length < 1 || content.length > 5000) {
      throw httpError(400, 'content must be between 1 and 5000 characters');
    }

    const messageData = {
      content: content.trim(),
      replyTo: replyTo || undefined,
      attachments: Array.isArray(attachments) ? attachments : [],
    };

    const result = await chatService.addMessage(conversationId, userId, messageData);

    logger.info('Message sent', {
      conversationId,
      messageId: result._id,
      userId,
    });

    // Emit Socket.IO event for real-time delivery
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:new', {
        conversationId,
        message: result,
      });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/conversations/:conversationId/messages/:messageId/read
 * Mark a message/messages in conversation as read
 *
 * Body: {
 *   messageIds: [id1, id2, ...] (optional: specific messages; if omitted, marks all unread)
 * }
 *
 * Returns: conversation with updated readBy for marked messages
 * Emits Socket.IO event: message:read (to conversation room)
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId, messageId } = req.params;
    const chatService = req.app.locals.chatService;
    const io = req.app.locals.io;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    // Mark single message or array based on request
    const target = messageId ? [messageId] : req.body.messageIds || [];
    if (target.length === 0 && messageId) {
      target.push(messageId);
    }

    const result = await chatService.markAsRead(conversationId, userId, target);

    logger.info('Message marked as read', {
      conversationId,
      messageCount: target.length,
      userId,
    });

    // Emit Socket.IO event
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:read', {
        conversationId,
        messageIds: target,
        userId,
      });
    }

    res.status(200).json({
      message: 'Message(s) marked as read',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/chat/conversations/:conversationId/messages/:messageId
 * Edit a message (only sender within 15 minutes)
 *
 * Body: {
 *   content: string (1-5000)
 * }
 *
 * Returns: updated message object
 * Emits Socket.IO event: message:edited (to conversation room)
 */
exports.editMessage = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId, messageId } = req.params;
    const { content } = req.body;
    const chatService = req.app.locals.chatService;
    const io = req.app.locals.io;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    // Validate
    if (!content || typeof content !== 'string') {
      throw httpError(400, 'content is required and must be string');
    }
    if (content.trim().length < 1 || content.length > 5000) {
      throw httpError(400, 'content must be between 1 and 5000 characters');
    }

    const result = await chatService.editMessage(conversationId, messageId, userId, {
      content: content.trim(),
    });

    logger.info('Message edited', {
      conversationId,
      messageId,
      userId,
    });

    // Emit Socket.IO event
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:edited', {
        conversationId,
        messageId,
        message: result,
      });
    }

    res.status(200).json({
      message: 'Message edited successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/chat/conversations/:conversationId/messages/:messageId
 * Delete a message (soft delete with deletedBy tracking)
 *
 * Returns: deleted message object (with deletedAt, deletedBy)
 * Emits Socket.IO event: message:deleted (to conversation room)
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId, messageId } = req.params;
    const chatService = req.app.locals.chatService;
    const io = req.app.locals.io;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    const result = await chatService.deleteMessage(conversationId, messageId, userId);

    logger.info('Message deleted', {
      conversationId,
      messageId,
      userId,
    });

    // Emit Socket.IO event
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:deleted', {
        conversationId,
        messageId,
      });
    }

    res.status(200).json({
      message: 'Message deleted successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/conversations/:conversationId/archive
 * Archive a conversation (soft delete for user)
 *
 * Returns: archived conversation object
 */
exports.archiveConversation = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId } = req.params;
    const chatService = req.app.locals.chatService;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    const result = await chatService.archiveConversation(conversationId, userId);

    logger.info('Conversation archived', {
      conversationId,
      userId,
    });

    res.status(200).json({
      message: 'Conversation archived successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chat/unread
 * Get unread message count per conversation
 *
 * Returns: array of { conversationId, unreadCount }
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const chatService = req.app.locals.chatService;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    const result = await chatService.getUnreadCount(userId);

    res.status(200).json({
      message: 'Unread counts retrieved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chat/conversations/:conversationId/search
 * Search messages in a conversation
 *
 * Query: ?q=search_term&page=1&limit=50
 * Returns: matching messages with sender populated
 */
exports.searchMessages = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { conversationId } = req.params;
    const { q } = req.query;
    const chatService = req.app.locals.chatService;

    if (!chatService) {
      return res.status(500).json({ error: 'Chat service not initialized' });
    }

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      throw httpError(400, 'q (search query) is required');
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const result = await chatService.searchMessages(conversationId, userId, q.trim(), {
      skip,
      limit,
    });

    res.status(200).json({
      message: 'Search results retrieved successfully',
      data: result.messages,
      pagination: { page, limit, total: result.total },
    });
  } catch (err) {
    next(err);
  }
};
