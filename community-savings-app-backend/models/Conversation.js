'use strict';

const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: [arr => arr.length > 0, 'Conversation must have at least one participant'],
    },

    type: {
      type: String,
      enum: [
        'DM',
        'GROUP',
        'ADMIN',
        'support',
        'loan-thread',
        'transaction-thread',
        'savings-thread',
        'admin-announcement'
      ],
      default: 'DM',
      uppercase: true,
      trim: true,
    },

    title: { type: String, trim: true },
    description: { type: String, trim: true },

    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    linkedEntityType: {
      type: String,
      enum: ['loan', 'transaction', 'savings', 'support', 'group'],
      default: null,
    },
    linkedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },

    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, index: true },
    lastActivityAt: { type: Date, default: Date.now },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: { type: String, enum: ['active', 'archived', 'closed'], default: 'active' },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    isAnnouncementChannel: { type: Boolean, default: false },

    pinnedMessageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],

    metadata: {
      name: { type: String, trim: true },
      description: { type: String, trim: true },
      avatarUrl: { type: String, trim: true },
      extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    softDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
ConversationSchema.index({ participants: 1, type: 1 });
ConversationSchema.index({ linkedEntityId: 1 });
ConversationSchema.index({ lastActivityAt: -1 });
ConversationSchema.index({ lastMessageAt: -1 });

// Virtual id
ConversationSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Static helper: find or create DM
ConversationSchema.statics.findOrCreateDM = async function (userA, userB) {
  const existing = await this.findOne({
    type: 'DM',
    participants: { $all: [userA, userB], $size: 2 },
  });
  if (existing) return existing;
  return this.create({ type: 'DM', participants: [userA, userB], createdBy: userA });
};

// Method: update lastMessageAt
ConversationSchema.methods.touch = function () {
  this.lastMessageAt = new Date();
  this.lastActivityAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Conversation', ConversationSchema);
