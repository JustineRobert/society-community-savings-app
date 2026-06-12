const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['dm', 'group', 'admin'], default: 'dm' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', ConversationSchema);
