// models/PasswordResetToken.js
'use strict';

const mongoose = require('mongoose');

const PasswordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
      // TTL index: auto-delete expired tokens
      expires: 0,
    },

    used: {
      type: Boolean,
      default: false,
      index: true,
    },

    usedAt: {
      type: Date,
    },

    requestIp: {
      type: String,
      trim: true,
      maxlength: 64,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for fast lookups
PasswordResetTokenSchema.index({ user: 1, tokenHash: 1 }, { unique: true });

// Helper: mark token as used
PasswordResetTokenSchema.methods.markUsed = function () {
  this.used = true;
  this.usedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
