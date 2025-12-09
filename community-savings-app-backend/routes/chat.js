// routes/chat.js

const express = require('express');
const router = express.Router();

// Middleware for verifying authentication
const { verifyToken } = require('../middleware/auth');

// Chat controller handlers
const {
  sendMessage,
  getGroupMessages,
  getUserMessages,   // Optional: for private/user-to-user messaging
  deleteMessage      // Optional: for admin/moderator cleanup
} = require('../controllers/chatController');

/**
 * @route   POST /api/chat
 * @desc    Send a message to a group
 * @access  Private (Authenticated Users)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    await sendMessage(req, res);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Server error while sending message' });
  }
});

/**
 * @route   GET /api/chat/group/:groupId
 * @desc    Retrieve all messages in a specific group
 * @access  Private (Authenticated Users)
 */
router.get('/group/:groupId', verifyToken, async (req, res) => {
  try {
    await getGroupMessages(req, res);
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ error: 'Server error while fetching group messages' });
  }
});

/**
 * @route   GET /api/chat/user/:userId
 * @desc    Retrieve messages between the logged-in user and a specific user
 * @access  Private (Optional Direct Messaging Feature)
 */
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    await getUserMessages(req, res);
  } catch (error) {
    console.error('Error fetching user messages:', error);
    res.status(500).json({ error: 'Server error while fetching user messages' });
  }
});

/**
 * @route   DELETE /api/chat/:messageId
 * @desc    Delete a specific message by its ID
 * @access  Private (Admin/Moderator Only)
 */
router.delete('/:messageId', verifyToken, async (req, res) => {
  try {
    await deleteMessage(req, res);
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Server error while deleting message' });
  }
});

module.exports = router;
