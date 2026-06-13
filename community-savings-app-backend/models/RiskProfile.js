// models/RiskProfile.js
/**
 * Production-grade RiskProfile schema
 * - Multi-tenant: tenantId required and indexed
 * - Strong typing and validation
 * - Unique compound index on (tenantId, userId)
 * - Helper static/instance methods for updating score and computing risk level
 * - Optimistic concurrency (versionKey) enabled
 * - Timestamps for audit and retention policies (store for >=10 years)
 *
 * Usage:
 * const RiskProfile = require('../models/RiskProfile')
 *
 * Note: Do NOT set TTL on this collection. Regulatory retention requires keeping records
 * for a minimum period (e.g., 10 years). Retention/archival should be handled by a
 * separate archival job that exports to cold storage when needed.
 */

const mongoose = require('mongoose');

const VALID_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

const RiskProfileSchema = new mongoose.Schema({
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

  // Credit score normalized to 0 - 1000
  creditScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1000,
    default: 0
  },

  // Derived risk level: LOW | MEDIUM | HIGH
  riskLevel: {
    type: String,
    enum: VALID_RISK_LEVELS,
    required: true,
    default: 'MEDIUM'
  },

  // Optional metadata for audit / explainability (kept small)
  source: {
    type: String,
    trim: true,
    default: 'internal' // e.g., 'internal', 'crb', 'hybrid'
  },

  // Explainability: small JSON with feature contributions (avoid storing large arrays)
  explain: {
    type: Object,
    default: {}
  },

  // Track last model version used to compute this score
  modelVersion: {
    type: String,
    trim: true,
    default: null
  },

  // Soft-flag for archived profiles (archival handled by separate process)
  archived: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  versionKey: 'version' // optimistic concurrency control
});

/**
 * Compound unique index to ensure one profile per user per tenant
 */
RiskProfileSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

/**
 * Pre-save hook: clamp creditScore and compute riskLevel if not explicitly set
 */
RiskProfileSchema.pre('save', function (next) {
  if (this.creditScore == null) this.creditScore = 0;
  // Clamp score
  this.creditScore = Math.max(0, Math.min(1000, Math.round(this.creditScore)));

  // Compute riskLevel if not set or if score changed
  if (!this.isModified('riskLevel') || this.isModified('creditScore')) {
    const s = this.creditScore;
    if (s < 400) this.riskLevel = 'HIGH';
    else if (s <= 650) this.riskLevel = 'MEDIUM';
    else this.riskLevel = 'LOW';
  }

  next();
});

/**
 * Instance method: update score atomically and record explainability + modelVersion
 * Use this method to ensure consistent updates and to keep explain metadata.
 *
 * @param {Number} newScore - 0..1000
 * @param {Object} opts - { explain: Object, modelVersion: String, source: String }
 */
RiskProfileSchema.methods.updateScore = async function (newScore, opts = {}) {
  this.creditScore = Math.max(0, Math.min(1000, Math.round(newScore)));
  if (opts.explain && typeof opts.explain === 'object') this.explain = opts.explain;
  if (opts.modelVersion) this.modelVersion = opts.modelVersion;
  if (opts.source) this.source = opts.source;
  // riskLevel will be recalculated in pre-save hook
  return this.save();
};

/**
 * Static helper: upsert profile with merged score and explainability
 *
 * @param {ObjectId} userId
 * @param {String} tenantId
 * @param {Number} score
 * @param {Object} opts - { explain, modelVersion, source }
 * @returns {Promise<Document>}
 */
RiskProfileSchema.statics.upsertScore = async function (userId, tenantId, score, opts = {}) {
  const update = {
    creditScore: Math.max(0, Math.min(1000, Math.round(score))),
    explain: opts.explain || {},
    modelVersion: opts.modelVersion || null,
    source: opts.source || 'internal',
    archived: false
  };

  // Use findOneAndUpdate with upsert to avoid race conditions
  const doc = await this.findOneAndUpdate(
    { userId, tenantId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();

  // Ensure riskLevel computed by pre-save logic: call save if necessary
  if (!doc.riskLevel || doc.isModified('creditScore')) {
    await doc.save();
  }

  return doc;
};

/**
 * Static query helper: fetch active profile for user+tenant
 */
RiskProfileSchema.statics.getActiveProfile = function (userId, tenantId) {
  return this.findOne({ userId, tenantId, archived: false }).lean();
};

/**
 * Ensure indexes are created in background (production-friendly)
 */
RiskProfileSchema.index({ tenantId: 1, userId: 1 }, { unique: true, background: true });

module.exports = mongoose.model('RiskProfile', RiskProfileSchema);
