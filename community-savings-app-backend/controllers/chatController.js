// controllers/chatController.js

const Chat = require('../models/Chat'); // Assuming you have a Chat model
const Group = require('../models/Group'); // For validating group existence (optional)

/**
 * @desc    Send a message to a group
 * @route   POST /api/chat
 * @access  Private
 */
exports.sendMessage = async (req, res) => {
  try {
    const { groupId, message } = req.body;

    if (!groupId || !message) {
      return res.status(400).json({ error: 'Group ID and message are required' });
    }

    const newMessage = new Chat({
      sender: req.user.id, // from auth middleware
      group: groupId,
      message
    });

    const savedMessage = await newMessage.save();

    res.status(201).json({
      message: 'Message sent successfully',
      data: savedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: 'Server error while sending message' });
  }
};

/**
 * @desc    Get messages for a group
 * @route   GET /api/chat/group/:groupId
 * @access  Private
 */
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;

    const messages = await Chat.find({ group: groupId })
      .populate('sender', 'name email') // Optional: populate sender info
      .sort({ createdAt: 1 });

    res.status(200).json({
      message: 'Messages retrieved successfully',
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Server error while fetching messages' });
  }
};
