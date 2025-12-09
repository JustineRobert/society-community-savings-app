const mongoose = require('mongoose');

/**
 * Chat Schema
 * Stores messages sent within groups by users
 */
const chatSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required'],
    index: true,
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group is required'],
    index: true,
  },
  message: {
    type: String,
    required: [true, 'Message cannot be empty'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
  },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = doc._id.toString();
      delete ret._id;
    },
  },
  toObject: { virtuals: true }
});

// Index for optimized retrieval by group and recency
chatSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
