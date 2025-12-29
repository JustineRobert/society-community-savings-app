
// controllers/chatController.js

const Chat = require('../models/Chat');
const Group = require('../models/Group');

/**
 * Create an Error with HTTP status. The global error handler should
 * honor `err.status` and `err.details` if present.
 */
function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details !== undefined) err.details = details;
  return err;
}

/**
 * Safely coerce any input to trimmed string. Returns '' for null/undefined.
 */
function toTrimmedString(v) {
  return (v ?? '').toString().trim();
}

/**
 * Basic text sanitization to reduce accidental script injection.
 * NOTE: For production-grade XSS protection, prefer a well-tested
 * library like `xss` or escape on render. This here is minimal.
 */
function sanitizeText(v) {
  const s = toTrimmedString(v);
  // Remove obvious <script> blocks; keep content as plain text.
  return s.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
}

/**
 * Normalize & validate pagination parameters.
 */
function getPagination({ page = 1, limit = 50 }, { max = 200 } = {}) {
  let p = Number(page);
  let l = Number(limit);
  if (!Number.isFinite(p) || p < 1) p = 1;
  if (!Number.isFinite(l) || l < 1) l = 50;
  if (l > max) l = max;
  const skip = (p - 1) * l;
  return { page: p, limit: l, skip };
}

/**
 * @desc    Send a message to a group
 * @route   POST /api/chat
 * @access  Private
 *
 * Expects: { groupId: string, content: string (1-5000), attachments?: [] }
 * Routes set validators; we still normalize and guard at controller.
 */
exports.sendMessage = async (req, res) => {
  // Normalize inputs
  const groupId = toTrimmedString(req.body.groupId);
  // Accept "content" (preferred per routes) or fallback to "message"
  const contentRaw = req.body.content ?? req.body.message;
  const content = sanitizeText(contentRaw);
  const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];

  if (!groupId || !content) {
    throw httpError(400, 'Group ID and content are required');
  }
  if (content.length < 1 || content.length > 5000) {
    throw httpError(400, 'Content must be between 1 and 5000 characters');
  }

  // Ensure user is present (auth middleware should set req.user)
  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    throw httpError(401, 'User authentication required');
  }

  // Verify group exists
  const group = await Group.findById(groupId).select('_id members').lean();
  if (!group) {
    throw httpError(404, 'Group not found');
  }

  // If your Group schema has a "members" array, enforce membership
  const hasMembersField = Group.schema.path('members') !== undefined;
  if (hasMembersField) {
    const userIdStr = String(userId);
    const isMember = Array.isArray(group.members) && group.members.some(m => String(m) === userIdStr);
    if (!isMember) {
      throw httpError(403, 'User is not a member of this group');
    }
  }

  // Prepare the message document
  const doc = {
    sender: userId,
    group: groupId,
    message: content, // store normalized content in "message" field in DB
  };

  // Only attach attachments if the schema supports it
  if (Chat.schema.path('attachments') && attachments.length) {
    // Optionally validate attachment shape here
    doc.attachments = attachments;
  }

  const saved = await new Chat(doc).save();

  // Optionally populate sender minimally; otherwise return saved as-is
  res.status(201).json({
    message: 'Message sent successfully',
    data: saved,
  });
};

/**
 * @desc    Get messages for a group (paginated, with optional date range)
 * @route   GET /api/chat/group/:groupId
 * @access  Private
 *
 * Query: ?page=1&limit=50&before=<ISO>&after=<ISO>
 * Routes validators ensure basic types; controller builds filter robustly.
 */
exports.getGroupMessages = async (req, res) => {
  const groupId = toTrimmedString(req.params.groupId);
  if (!groupId) {
    throw httpError(400, 'groupId is required');
  }

  // Verify group exists (cheap guard; avoids querying a non-existent group)
  const groupExists = await Group.exists({ _id: groupId });
  if (!groupExists) {
    throw httpError(404, 'Group not found');
  }

  const { page, limit, skip } = getPagination(req.query, { max: 200 });

  // Build date range filter
  const filter = { group: groupId };
  const createdAtRange = {};
  const before = req.query.before ? new Date(req.query.before) : null;
  const after = req.query.after ? new Date(req.query.after) : null;

  if (before && !isNaN(before.getTime())) createdAtRange.$lt = before;
  if (after && !isNaN(after.getTime())) createdAtRange.$gt = after;
  if (Object.keys(createdAtRange).length) filter.createdAt = createdAtRange;

  // Projection for performance; adjust to your schema fields
  const projection = '_id group sender message attachments createdAt';

  const [items, total] = await Promise.all([
    Chat.find(filter)
      .select(projection)
      .populate('sender', 'name email') // optional, as in your original
      .sort({ createdAt: 1 })           // ascending to match routes
      .skip(skip)
      .limit(limit)
      .lean(),
    Chat.countDocuments(filter),
  ]);

  const hasMore = skip + items.length < total;

  res.status(200).json({
    message: 'Messages retrieved successfully',
    count: items.length,
    data: items,
    page,
    limit,
    total,
    hasMore,
  });
};

/**
 * @desc    Get direct messages with a specific user (paginated)
 * @route   GET /api/chat/user/:userId
 * @access  Private
 *
 * Requires Chat schema to have a "recipient" field for DMs.
 */
exports.getUserMessages = async (req, res) => {
  const recipientId = toTrimmedString(req.params.userId);
  const viewerId = req.user?.id || req.user?._id;

  if (!viewerId) {
    throw httpError(401, 'User authentication required');
  }
  if (!recipientId) {
    throw httpError(400, 'userId is required');
  }

  // If Chat schema does not support DMs, return 501 instead of crashing.
  const hasRecipient = Chat.schema.path('recipient') !== undefined;
  if (!hasRecipient) {
    throw httpError(501, 'Direct messaging is not enabled on this server');
  }

  const { page, limit, skip } = getPagination(req.query, { max: 200 });

  const filter = {
    $or: [
      { sender: viewerId, recipient: recipientId },
      { sender: recipientId, recipient: viewerId },
    ],
  };

  const projection = '_id sender recipient message attachments createdAt';

  const [items, total] = await Promise.all([
    Chat.find(filter)
      .select(projection)
      .sort({ createdAt: -1 }) // newest first for DMs
      .skip(skip)
      .limit(limit)
      .lean(),
    Chat.countDocuments(filter),
  ]);

  const hasMore = skip + items.length < total;

  res.status(200).json({
    message: 'Direct messages retrieved successfully',
    count: items.length,
    data: items,
    page,
    limit,
    total,
    hasMore,
  });
};

/**
 * @desc    Delete a specific message by its ID
 * @route   DELETE /api/chat/:messageId
 * @access  Private (Admin/Moderator only via route middleware)
 *
 * NOTE: Routes already enforce roles via requireRole('admin', 'group_admin').
 * This controller will still gracefully handle common cases.
 */
exports.deleteMessage = async (req, res) => {
  const messageId = toTrimmedString(req.params.messageId);
  if (!messageId) {
    throw httpError(400, 'messageId is required');
  }

  const msg = await Chat.findById(messageId).select('_id sender group').lean();
  if (!msg) {
    throw httpError(404, 'Message not found');
  }

  // If you want to allow owners to delete their own messages (even without admin),
  // uncomment the ownership check below and make sure your route permits it:
  //
  // const viewerId = req.user?.id || req.user?._id;
  // if (!viewerId) {
  //   throw httpError(401, 'User authentication required');
  // }
  // const isOwner = String(msg.sender) === String(viewerId);
  // if (!isOwner && !req.user?.roles?.some(r => ['admin', 'group_admin'].includes(r))) {
  //   throw httpError(403, 'Not authorized to delete this message');
  // }

  const deleted = await Chat.findByIdAndDelete(messageId).lean();
  // findByIdAndDelete returns the deleted doc or null; we already checked existence.

  res.status(200).json({ message: 'Message deleted successfully', data: deleted });
};
