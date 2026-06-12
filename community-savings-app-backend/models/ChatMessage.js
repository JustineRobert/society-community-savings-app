const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: [{ type: mongoose.Schema.Types.Mixed }],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
