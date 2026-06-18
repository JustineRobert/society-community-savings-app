'use strict';

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    senderRole: {
      type: String,
      enum: ['ADMIN', 'MEMBER', 'SUPPORT', 'AUDITOR'],
      required: true,
    },

    body: {
      type: String,
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },

    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'system', 'announcement'],
      default: 'text',
    },

    // Attachments: reuse file upload utilities
    attachments: [
      {
        url: { type: String, required: true },
        filename: { type: String },
        mimetype: {
          type: String,
          match: [/^(image|application|text)\//, 'Invalid file type'],
        },
        size: { type: Number, max: 10 * 1024 * 1024 }, // 10 MB limit
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    // Read and delivery tracking
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Edit/delete audit metadata
    editedAt: { type: Date },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Reply threading
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },

    // System and audit metadata
    systemMetadata: { type: Map, of: String },
    auditMetadata: { type: Map, of: String },
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
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });

// Virtual id
MessageSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Method: mark as read
MessageSchema.methods.markAsRead = async function (userId) {
  const alreadyRead = this.readBy.some(r => r.user.equals(userId));
  if (!alreadyRead) {
    this.readBy.push({ user: userId, readAt: new Date() });
    await this.save();
  }
  return this;
};

// Method: soft delete
MessageSchema.methods.softDelete = async function (userId) {
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
  return this;
};

// Method: edit message
MessageSchema.methods.editMessage = async function (newBody, userId) {
  if (!newBody || newBody.trim().length === 0) {
    throw new Error('Message body cannot be empty');
  }
  this.body = newBody.trim();
  this.editedAt = new Date();
  this.editedBy = userId;
  await this.save();
  return this;
};

// Method: add attachment
MessageSchema.methods.addAttachment = async function (attachment, userId) {
  if (!attachment.url) throw new Error('Attachment must have a URL');
  this.attachments.push({ ...attachment, uploadedBy: userId });
  await this.save();
  return this;
};

module.exports = mongoose.model('Message', MessageSchema);
