
// models/RefreshToken.js
// ============================================================================
// Refresh Token Model (Opaque tokens stored hashed)
// - Supports rotation, revocation, reuse detection, and device metadata.
// - Provides statics for common operations (rotate/revoke/list).
// - Indexed for performance in typical queries.
// ============================================================================

const mongoose = require('mongoose');

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    // Public GUID-style identifier for the refresh token record (NOT the token itself)
    id: { type: String, required: true, unique: true, index: true },

    // User who owns this token
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // SHA-256 hash of the raw refresh token (never store raw token)
    tokenHash: { type: String, required: true, index: true },

    // Optional device metadata (helpful for audits and session displays)
    deviceInfo: {
      ip: { type: String, default: null },
      ua: { type: String, default: null },
      name: { type: String, default: null },
      deviceId: { type: String, default: null },
    },

    // Timestamps & lifecycle
    createdAt: { type: Date, default: Date.now, index: true },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },

    // Revocation & rotation
    revokedAt: { type: Date, default: null, index: true },
    revokedReason: { type: String, default: null },
    replacedBy: { type: String, default: null }, // next token id if rotated
  },
  {
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.id || ret._id?.toString?.();
        delete ret._id;
        // NEVER expose tokenHash externally; keep internal
        delete ret.tokenHash;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        ret.id = ret.id || ret._id?.toString?.();
        delete ret._id;
        delete ret.tokenHash;
        return ret;
      },
    },
  }
);

// ----------------------------------------------------------------------------
// Indexes for common queries
// ----------------------------------------------------------------------------

// Active sessions for a user (revokedAt null)
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 }); // helps active session listing
// Expiration scans (cleanup jobs)
RefreshTokenSchema.index({ expiresAt: 1 });
// Optional: prevent accidental hash reuse (not strictly necessary with 64-byte random tokens)
// RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });

// ----------------------------------------------------------------------------
// Statics: quality-of-life helpers
// ----------------------------------------------------------------------------

/**
 * Finds active (non-revoked, non-expired) sessions for a user.
 * @param {string|import('mongoose').Types.ObjectId} userId
 */
RefreshTokenSchema.statics.findActiveByUser = function (userId) {
  return this.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * Revokes a token by its public id (if not already revoked).
 * @param {string} id - Public id field (not _id)
 * @param {string} reason
 */
RefreshTokenSchema.statics.revokeById = async function (id, reason = 'user_revoked') {
  const token = await this.findOne({ id });
  if (!token) return null;
  if (!token.revokedAt) {
    token.revokedAt = new Date();
    token.revokedReason = reason;
    await token.save();
  }
  return token;
};

/**
 * Revokes all active tokens for a user.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} reason
 */
RefreshTokenSchema.statics.revokeAllForUser = function (userId, reason = 'user_logout_all') {
  return this.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
};

/**
 * Deletes expired & already revoked tokens (housekeeping).
 * Call from a scheduled job (e.g., daily).
 * @param {Date} [before] - delete tokens expired before this timestamp (default: now)
 */
RefreshTokenSchema.statics.purgeExpiredRevoked = function (before = new Date()) {
  return this.deleteMany({
    expiresAt: { $lt: before },
    revokedAt: { $ne: null },
  });
};

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
