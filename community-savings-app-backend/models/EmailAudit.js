// models/EmailAudit.js
// ============================================================================
// Email Audit Model
// Tracks all email-related operations for security, compliance, and debugging
// ============================================================================

const mongoose = require('mongoose');

const emailAuditSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: [
        'send_verification_email',
        'verify_email',
        'request_password_reset',
        'reset_password',
        'change_password',
        'resend_verification_email',
      ],
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      sparse: true,
    },

    ipAddress: {
      type: String,
      index: true,
      sparse: true,
    },

    userAgent: {
      type: String,
      sparse: true,
    },

    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      sparse: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 7776000, // TTL: 90 days - auto-delete old audit logs
    },
  },
  {
    collection: 'email_audits',
    versionKey: false,
  }
);

// Index for common queries
emailAuditSchema.index({ userId: 1, event: 1, timestamp: -1 });
emailAuditSchema.index({ email: 1, event: 1, timestamp: -1 });
emailAuditSchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('EmailAudit', emailAuditSchema);
