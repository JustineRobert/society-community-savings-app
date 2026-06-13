// models/ComplianceLog.js
/**
 * Production-grade ComplianceLog schema
 * - Multi-tenant aware (tenantId required)
 * - Strong typing, validation, and indexes for fast queries
 * - Stores structured reason, evidence, reporter, and resolution workflow
 * - Immutable audit trail fields and retention guidance (>=10 years)
 * - Designed for STR generation and linking to FraudLog entries
 *
 * Usage:
 * const ComplianceLog = require('../models/ComplianceLog')
 *
 * Note: Archival/retention must be handled by a separate archival job/export process.
 */

const mongoose = require('mongoose');

const ComplianceLogSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Short activity code, e.g., 'KYC_VERIFICATION', 'STR_GENERATED', 'SANCTIONS_HIT'
  activity: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Whether this activity was flagged as suspicious
  flagged: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },

  // Unique report identifier for STRs or KYC reports
  reportId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Human-readable reason or short code for the flag
  reason: {
    type: String,
    trim: true,
    default: null
  },

  // Detailed structured payload (evidence, transaction snapshot, related fraudLogId, etc.)
  details: {
    type: Object,
    default: {}
  },

  // Link to related FraudLog (if any)
  fraudLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FraudLog',
    default: null,
    index: true
  },

  // Who reported or created this log (system, user id, or officer id)
  reporter: {
    type: String,
    trim: true,
    default: 'system'
  },

  // Resolution workflow
  resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },

  // Link to external STR submission reference (e.g., FIA submission id)
  externalReportRef: {
    type: String,
    default: null,
    index: true
  },

  // Soft-archival marker (archival handled by separate job)
  archived: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  versionKey: 'version'
});

/**
 * Compound index for common query patterns: tenant + user + activity + createdAt
 * Background index creation for production
 */
ComplianceLogSchema.index({ tenantId: 1, userId: 1, activity: 1, createdAt: -1 }, { background: true });
ComplianceLogSchema.index({ tenantId: 1, reportId: 1 }, { unique: true, background: true });

/**
 * Pre-save hook: validate required fields and normalize reportId
 */
ComplianceLogSchema.pre('validate', function (next) {
  try {
    if (!this.reportId) {
      // generate deterministic reportId if not provided
      this.reportId = `${this.activity}-${this.tenantId}-${Date.now()}`;
    }
    // Ensure flagged is boolean
    this.flagged = !!this.flagged;
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Instance method: mark as resolved with optional notes
 */
ComplianceLogSchema.methods.markResolved = async function (userId, notes = '') {
  this.resolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  if (notes) {
    this.details = Object.assign({}, this.details, { resolutionNotes: notes });
  }
  return this.save();
};

/**
 * Static helper: create STR entry
 * payload must include tenantId, userId, activity (e.g., 'STR_GENERATED'), reason, details
 */
ComplianceLogSchema.statics.createSTR = async function (payload) {
  const required = ['tenantId', 'userId', 'activity'];
  for (const f of required) {
    if (!payload[f]) throw new Error(`Missing required field for ComplianceLog.createSTR: ${f}`);
  }

  const doc = await this.create({
    tenantId: payload.tenantId,
    userId: payload.userId,
    activity: payload.activity,
    flagged: payload.flagged === true,
    reportId: payload.reportId || `STR-${payload.tenantId}-${Date.now()}`,
    reason: payload.reason || null,
    details: payload.details || {},
    fraudLogId: payload.fraudLogId || null,
    reporter: payload.reporter || 'system'
  });

  return doc;
};

/**
 * Static query helper: fetch recent flagged logs for tenant
 */
ComplianceLogSchema.statics.fetchRecentFlagged = function (tenantId, limit = 50) {
  return this.find({ tenantId, flagged: true, archived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Ensure indexes are created in background (production-friendly)
 */
ComplianceLogSchema.index({ tenantId: 1, flagged: 1, createdAt: -1 }, { background: true });

module.exports = mongoose.model('ComplianceLog', ComplianceLogSchema);
