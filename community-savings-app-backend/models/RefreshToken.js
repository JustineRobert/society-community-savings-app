// ============================================================================
// TITech Community Capital
// Enterprise Refresh Token Model
//
// File:
// backend/models/RefreshToken.js
//
// Production Grade
// Opaque Refresh Tokens | SHA-256 Hashing
// Rotation | Token Families | Reuse Detection
// Atomic Revocation | Device Sessions | Audit Metadata
// TTL Cleanup | Multi-Tenant Security | Concurrency Safety
//
// SECURITY MODEL
//
// - Raw refresh tokens are NEVER persisted.
// - tokenHash contains only a SHA-256 digest.
// - Refresh tokens are rotated on successful use.
// - Every rotation remains inside the same token family.
// - A previously rotated token can never become active again.
// - Reuse detection can revoke the complete token family.
// - Token rotation uses an atomic compare-and-set operation.
// - Tenant ownership is retained at the session boundary.
// - Access tokens are short-lived and are NOT represented here.
//
// IMPORTANT
//
// This model does NOT issue refresh tokens.
// Token issuance, cookie management, authentication policy and transaction
// orchestration belong in the authentication/session service.
//
// The backend remains authoritative for authentication and authorization.
//
// IMPORTANT TRANSACTION NOTE
//
// For highest assurance, the authentication service should perform:
//
//   1. Validate current refresh token.
//   2. Atomically consume/rotate current token.
//   3. Create replacement token.
//   4. Commit both operations in one MongoDB transaction.
//
// A retry after a successful rotation must be treated as token reuse.
// ============================================================================

"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");

const { Schema } = mongoose;

// ============================================================================
// Constants
// ============================================================================

const TOKEN_HASH_ALGORITHM = "sha256";

const TOKEN_ID_BYTES = 16;
const TOKEN_FAMILY_BYTES = 16;

const MAX_REASON_LENGTH = 128;
const MAX_DEVICE_NAME_LENGTH = 256;
const MAX_DEVICE_ID_LENGTH = 256;
const MAX_USER_AGENT_LENGTH = 2048;
const MAX_IP_LENGTH = 128;
const MAX_ISSUED_BY_LENGTH = 128;

const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/;
const TOKEN_FAMILY_PATTERN = /^[a-f0-9]{32}$/;

// ============================================================================
// Immutable Security Helpers
// ============================================================================

function generatePublicId() {
  return crypto
    .randomBytes(TOKEN_ID_BYTES)
    .toString("hex");
}

function generateTokenFamilyId() {
  return crypto
    .randomBytes(TOKEN_FAMILY_BYTES)
    .toString("hex");
}

/**
 * Hash a raw refresh token.
 *
 * SECURITY:
 * - The raw token exists only in request memory.
 * - The raw token is never persisted.
 * - The resulting digest is deterministic and suitable for indexed lookup.
 */
function hashToken(rawToken) {
  if (
    typeof rawToken !== "string" ||
    rawToken.length === 0
  ) {
    throw new TypeError(
      "A non-empty refresh token is required."
    );
  }

  return crypto
    .createHash(TOKEN_HASH_ALGORITHM)
    .update(rawToken, "utf8")
    .digest("hex");
}

/**
 * Constant-time comparison for token hashes.
 *
 * Normally MongoDB performs the hash lookup directly. This helper is exposed
 * for authentication services that need an explicit comparison after loading
 * a candidate digest.
 */
function hashesEqual(left, right) {
  if (
    typeof left !== "string" ||
    typeof right !== "string"
  ) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (
    leftBuffer.length !== rightBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

function normalizeString(
  value,
  maxLength
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .slice(0, maxLength);

  return normalized || null;
}

function normalizeReason(reason) {
  return (
    normalizeString(
      reason,
      MAX_REASON_LENGTH
    ) || "unspecified"
  );
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

// ============================================================================
// Device Metadata
// ============================================================================

const DeviceInfoSchema =
  new Schema(
    {
      ip: {
        type: String,
        default: null,
        trim: true,
        maxlength: MAX_IP_LENGTH,
      },

      ua: {
        type: String,
        default: null,
        trim: true,
        maxlength:
          MAX_USER_AGENT_LENGTH,
      },

      name: {
        type: String,
        default: null,
        trim: true,
        maxlength:
          MAX_DEVICE_NAME_LENGTH,
      },

      deviceId: {
        type: String,
        default: null,
        trim: true,
        maxlength:
          MAX_DEVICE_ID_LENGTH,
      },
    },
    {
      _id: false,
      versionKey: false,
    }
  );

// ============================================================================
// Refresh Token Schema
// ============================================================================

const RefreshTokenSchema =
  new Schema(
    {
      // ----------------------------------------------------------------------
      // Public session/token-record identifier.
      //
      // This is NOT the refresh token.
      // ----------------------------------------------------------------------

      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
        default: generatePublicId,
        match: PUBLIC_ID_PATTERN,
      },

      // ----------------------------------------------------------------------
      // User ownership.
      // ----------------------------------------------------------------------

      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        immutable: true,
        index: true,
      },

      // ----------------------------------------------------------------------
      // Tenant boundary.
      //
      // A null tenantId is permitted for installations where tenant scoping
      // is not enabled. Authentication services should nevertheless enforce
      // tenant consistency whenever tenantId is present.
      // ----------------------------------------------------------------------

      tenantId: {
        type: Schema.Types.ObjectId,
        ref: "Tenant",
        default: null,
        immutable: true,
        index: true,
      },

      // ----------------------------------------------------------------------
      // SHA-256 token digest.
      //
      // NEVER expose this field through API responses.
      // NEVER log this field.
      // ----------------------------------------------------------------------

      tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
        select: false,
        minlength: 64,
        maxlength: 64,
        match: /^[a-f0-9]{64}$/,
      },

      // ----------------------------------------------------------------------
      // Token family.
      //
      // Rotation preserves this value.
      //
      // token-1 -> token-2 -> token-3
      //              |
      //              +-- same family
      //
      // Reuse of an old token should revoke the family.
      // ----------------------------------------------------------------------

      familyId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
        default:
          generateTokenFamilyId,
        match: TOKEN_FAMILY_PATTERN,
      },

      // ----------------------------------------------------------------------
      // Lifecycle.
      // ----------------------------------------------------------------------

      createdAt: {
        type: Date,
        required: true,
        immutable: true,
        default: Date.now,
        index: true,
      },

      lastUsedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      // ----------------------------------------------------------------------
      // Revocation.
      // ----------------------------------------------------------------------

      revokedAt: {
        type: Date,
        default: null,
        index: true,
      },

      revokedReason: {
        type: String,
        default: null,
        trim: true,
        maxlength:
          MAX_REASON_LENGTH,
      },

      // ----------------------------------------------------------------------
      // Rotation lineage.
      // ----------------------------------------------------------------------

      replacedBy: {
        type: String,
        default: null,
        index: true,
        maxlength: 64,
      },

      replacedAt: {
        type: Date,
        default: null,
      },

      // ----------------------------------------------------------------------
      // Refresh-token reuse detection.
      // ----------------------------------------------------------------------

      reuseDetectedAt: {
        type: Date,
        default: null,
        index: true,
      },

      reuseDetectedReason: {
        type: String,
        default: null,
        trim: true,
        maxlength:
          MAX_REASON_LENGTH,
      },

      // ----------------------------------------------------------------------
      // Device/session metadata.
      // ----------------------------------------------------------------------

      deviceInfo: {
        type: DeviceInfoSchema,
        default: () => ({}),
      },

      // ----------------------------------------------------------------------
      // Issuance metadata.
      // ----------------------------------------------------------------------

      issuedBy: {
        type: String,
        default: "password_login",
        trim: true,
        maxlength:
          MAX_ISSUED_BY_LENGTH,
      },

      // ----------------------------------------------------------------------
      // Most recent activity metadata.
      // ----------------------------------------------------------------------

      lastUsedIp: {
        type: String,
        default: null,
        trim: true,
        maxlength: MAX_IP_LENGTH,
      },

      lastUsedUserAgent: {
        type: String,
        default: null,
        trim: true,
        maxlength:
          MAX_USER_AGENT_LENGTH,
      },
    },
    {
      versionKey: false,
      timestamps: false,

      strict: true,

      toJSON: {
        transform(doc, ret) {
          ret.id =
            ret.id ||
            ret._id?.toString?.();

          delete ret._id;
          delete ret.tokenHash;

          return ret;
        },
      },

      toObject: {
        transform(doc, ret) {
          ret.id =
            ret.id ||
            ret._id?.toString?.();

          delete ret._id;
          delete ret.tokenHash;

          return ret;
        },
      },
    }
  );

// ============================================================================
// Validation
// ============================================================================

RefreshTokenSchema.pre(
  "validate",
  function validateRefreshToken(
    next
  ) {
    if (
      this.expiresAt &&
      this.createdAt &&
      this.expiresAt <=
        this.createdAt
    ) {
      return next(
        new mongoose.Error.ValidationError(
          this
        )
      );
    }

    if (
      this.revokedAt &&
      this.replacedAt &&
      this.replacedAt <
        this.revokedAt
    ) {
      return next(
        new mongoose.Error.ValidationError(
          this
        )
      );
    }

    if (
      this.replacedBy &&
      !this.replacedAt
    ) {
      return next(
        new mongoose.Error.ValidationError(
          this
        )
      );
    }

    if (
      this.reuseDetectedAt &&
      !this.revokedAt
    ) {
      return next(
        new mongoose.Error.ValidationError(
          this
        )
      );
    }

    next();
  }
);

// ============================================================================
// Indexes
// ============================================================================

// Active sessions for a user.
RefreshTokenSchema.index({
  userId: 1,
  revokedAt: 1,
  expiresAt: 1,
});

// Active sessions for a tenant.
RefreshTokenSchema.index({
  tenantId: 1,
  revokedAt: 1,
  expiresAt: 1,
});

// Token family security operations.
RefreshTokenSchema.index({
  familyId: 1,
  revokedAt: 1,
});

// User + token family operations.
RefreshTokenSchema.index({
  userId: 1,
  familyId: 1,
});

// Device/session management.
RefreshTokenSchema.index({
  userId: 1,
  "deviceInfo.deviceId": 1,
  revokedAt: 1,
});

// Recently active sessions.
RefreshTokenSchema.index({
  userId: 1,
  lastUsedAt: -1,
});

// Rotation lineage.
RefreshTokenSchema.index({
  replacedBy: 1,
});

// Security incident lookup.
RefreshTokenSchema.index({
  reuseDetectedAt: 1,
});

// MongoDB TTL cleanup.
RefreshTokenSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
    name:
      "refresh_token_expiration_ttl",
  }
);

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Determine whether the token is currently usable.
 */
RefreshTokenSchema.methods.isActive =
  function isActive(
    now = new Date()
  ) {
    return (
      !this.revokedAt &&
      this.expiresAt instanceof Date &&
      this.expiresAt > now
    );
  };

/**
 * Determine whether the token has expired.
 */
RefreshTokenSchema.methods.isExpired =
  function isExpired(
    now = new Date()
  ) {
    return (
      !this.expiresAt ||
      this.expiresAt <= now
    );
  };

/**
 * Determine whether this token has already been rotated.
 */
RefreshTokenSchema.methods.isRotated =
  function isRotated() {
    return (
      this.revokedReason ===
        "rotated" ||
      Boolean(this.replacedBy)
  );
};

/**
 * Determine whether reuse was detected.
 */
RefreshTokenSchema.methods.hasReuseDetection =
  function hasReuseDetection() {
    return Boolean(
      this.reuseDetectedAt
    );
  };

/**
 * Revoke this token.
 *
 * The operation is intentionally idempotent.
 */
RefreshTokenSchema.methods.revoke =
  async function revoke(
    reason = "revoked"
  ) {
    if (this.revokedAt) {
      return this;
    }

    const now =
      new Date();

    const updated =
      await this.constructor.findOneAndUpdate(
        {
          _id: this._id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: now,
            revokedReason:
              normalizeReason(reason),
          },
        },
        {
          new: true,
        }
      );

    return updated || this;
  };

// ============================================================================
// Statics: Token Lookup
// ============================================================================

RefreshTokenSchema.statics.findByPublicId =
  function findByPublicId(
    id
  ) {
    if (
      typeof id !== "string" ||
      !PUBLIC_ID_PATTERN.test(id)
    ) {
      return null;
    }

    return this.findOne({
      id,
    });
  };

/**
 * Find by raw refresh token.
 *
 * SECURITY:
 * The raw token is immediately transformed into a SHA-256 digest.
 */
RefreshTokenSchema.statics.findByRawToken =
  function findByRawToken(
    rawToken
  ) {
    if (
      typeof rawToken !== "string" ||
      rawToken.length === 0
    ) {
      return null;
    }

    const tokenHash =
      hashToken(rawToken);

    return this.findOne({
      tokenHash,
    }).select(
      "+tokenHash"
    );
  };

/**
 * Find by raw token with optional tenant boundary.
 */
RefreshTokenSchema.statics.findByRawTokenForTenant =
  function findByRawTokenForTenant(
    rawToken,
    tenantId
  ) {
    if (
      typeof rawToken !== "string" ||
      rawToken.length === 0
    ) {
      return null;
    }

    if (
      !tenantId ||
      !mongoose.isValidObjectId(
        tenantId
      )
    ) {
      return null;
    }

    const tokenHash =
      hashToken(rawToken);

    return this.findOne({
      tokenHash,
      tenantId,
    }).select(
      "+tokenHash"
    );
  };

// ============================================================================
// Statics: Active Sessions
// ============================================================================

RefreshTokenSchema.statics.findActiveByUser =
  function findActiveByUser(
    userId,
    options = {}
  ) {
    const query = {
      userId,
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    };

    if (options.tenantId) {
      query.tenantId =
        options.tenantId;
    }

    return this.find(query).sort({
      lastUsedAt: -1,
      createdAt: -1,
    });
  };

RefreshTokenSchema.statics.findActiveByTenant =
  function findActiveByTenant(
    tenantId
  ) {
    return this.find({
      tenantId,
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    }).sort({
      lastUsedAt: -1,
      createdAt: -1,
    });
  };

RefreshTokenSchema.statics.findActiveByFamily =
  function findActiveByFamily(
    familyId
  ) {
    if (
      typeof familyId !== "string" ||
      !familyId
    ) {
      return this.find({
        _id: null,
      });
    }

    return this.find({
      familyId,
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    }).sort({
      createdAt: -1,
    });
  };

// ============================================================================
// Statics: Atomic Revocation
// ============================================================================

/**
 * Atomically revoke a session by public id.
 */
RefreshTokenSchema.statics.revokeById =
  async function revokeById(
    id,
    reason = "user_revoked"
  ) {
    if (
      typeof id !== "string" ||
      !id
    ) {
      return null;
    }

    return this.findOneAndUpdate(
      {
        id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason:
            normalizeReason(reason),
        },
      },
      {
        new: true,
      }
    );
  };

/**
 * Tenant-scoped atomic revocation.
 *
 * This prevents an administrator from accidentally revoking a session
 * belonging to another tenant.
 */
RefreshTokenSchema.statics.revokeByIdForTenant =
  async function revokeByIdForTenant(
    id,
    tenantId,
    reason = "admin_revoked"
  ) {
    if (
      typeof id !== "string" ||
      !id ||
      !tenantId
    ) {
      return null;
    }

    return this.findOneAndUpdate(
      {
        id,
        tenantId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason:
            normalizeReason(reason),
        },
      },
      {
        new: true,
      }
    );
  };

/**
 * Revoke all active sessions belonging to a user.
 */
RefreshTokenSchema.statics.revokeAllForUser =
  function revokeAllForUser(
    userId,
    reason = "user_logout_all",
    options = {}
  ) {
    const query = {
      userId,
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    };

    if (options.tenantId) {
      query.tenantId =
        options.tenantId;
    }

    return this.updateMany(
      query,
      {
        $set: {
          revokedAt: new Date(),
          revokedReason:
            normalizeReason(reason),
        },
      }
    );
  };

/**
 * Revoke every active token in a family.
 *
 * This is the primary response to refresh-token reuse.
 */
RefreshTokenSchema.statics.revokeFamily =
  function revokeFamily(
    familyId,
    reason = "refresh_token_reuse",
    options = {}
  ) {
    if (
      typeof familyId !== "string" ||
      !familyId
    ) {
      return {
        acknowledged: false,
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    const query = {
      familyId,
      revokedAt: null,
    };

    if (options.tenantId) {
      query.tenantId =
        options.tenantId;
    }

    return this.updateMany(
      query,
      {
        $set: {
          revokedAt: new Date(),
          revokedReason:
            normalizeReason(reason),
        },
      }
    );
  };

// ============================================================================
// Statics: Atomic Rotation
// ============================================================================

/**
 * Atomically consumes an active refresh token.
 *
 * This is a compare-and-set operation:
 *
 *     active token
 *          |
 *          v
 *       rotated
 *
 * Only ONE concurrent request can successfully perform this transition.
 *
 * Returns:
 *   updated document -> rotation succeeded
 *   null             -> token was already revoked/expired/missing
 *
 * The authentication service MUST treat a null result carefully:
 * if the token exists and is already revoked because of rotation, that can
 * indicate refresh-token reuse.
 */
RefreshTokenSchema.statics.markRotated =
  async function markRotated(
    tokenId,
    replacementId
  ) {
    if (
      typeof tokenId !== "string" ||
      !tokenId ||
      typeof replacementId !== "string" ||
      !replacementId
    ) {
      throw new TypeError(
        "tokenId and replacementId are required."
      );
    }

    const now =
      new Date();

    return this.findOneAndUpdate(
      {
        id: tokenId,
        revokedAt: null,
        expiresAt: {
          $gt: now,
        },
      },
      {
        $set: {
          revokedAt: now,
          revokedReason: "rotated",
          replacedBy: replacementId,
          replacedAt: now,
          lastUsedAt: now,
        },
      },
      {
        new: true,
      }
    );
  };

/**
 * Stronger tenant-scoped rotation primitive.
 */
RefreshTokenSchema.statics.markRotatedForTenant =
  async function markRotatedForTenant(
    tokenId,
    replacementId,
    tenantId
  ) {
    if (
      typeof tokenId !== "string" ||
      !tokenId ||
      typeof replacementId !== "string" ||
      !replacementId ||
      !tenantId
    ) {
      throw new TypeError(
        "tokenId, replacementId and tenantId are required."
      );
    }

    const now =
      new Date();

    return this.findOneAndUpdate(
      {
        id: tokenId,
        tenantId,
        revokedAt: null,
        expiresAt: {
          $gt: now,
        },
      },
      {
        $set: {
          revokedAt: now,
          revokedReason: "rotated",
          replacedBy: replacementId,
          replacedAt: now,
          lastUsedAt: now,
        },
      },
      {
        new: true,
      }
    );
  };

// ============================================================================
// Statics: Reuse Detection
// ============================================================================

/**
 * Record refresh-token reuse.
 *
 * This operation only records the security event.
 *
 * The authentication service should immediately follow this with:
 *
 *     revokeFamily(token.familyId)
 *
 * preferably within the same transaction where operationally possible.
 */
RefreshTokenSchema.statics.markReuseDetected =
  async function markReuseDetected(
    tokenId,
    reason = "refresh_token_reuse"
  ) {
    if (
      typeof tokenId !== "string" ||
      !tokenId
    ) {
      return null;
    }

    const now =
      new Date();

    return this.findOneAndUpdate(
      {
        id: tokenId,
        revokedAt: {
          $ne: null,
        },
        reuseDetectedAt: null,
      },
      {
        $set: {
          reuseDetectedAt: now,
          reuseDetectedReason:
            normalizeReason(reason),
        },
      },
      {
        new: true,
      }
    );
  };

// ============================================================================
// Statics: Session Activity
// ============================================================================

/**
 * Update session activity only while the session is still active.
 */
RefreshTokenSchema.statics.touch =
  function touch(
    tokenId,
    metadata = {}
  ) {
    if (
      typeof tokenId !== "string" ||
      !tokenId
    ) {
      return null;
    }

    const update = {
      lastUsedAt: new Date(),
    };

    if (
      metadata.ip !== undefined
    ) {
      update.lastUsedIp =
        normalizeString(
          metadata.ip,
          MAX_IP_LENGTH
        );
    }

    if (
      metadata.userAgent !== undefined
    ) {
      update.lastUsedUserAgent =
        normalizeString(
          metadata.userAgent,
          MAX_USER_AGENT_LENGTH
        );
    }

    return this.findOneAndUpdate(
      {
        id: tokenId,
        revokedAt: null,
        expiresAt: {
          $gt: new Date(),
        },
      },
      {
        $set: update,
      },
      {
        new: true,
      }
    );
  };

/**
 * Tenant-scoped activity update.
 */
RefreshTokenSchema.statics.touchForTenant =
  function touchForTenant(
    tokenId,
    tenantId,
    metadata = {}
  ) {
    if (
      typeof tokenId !== "string" ||
      !tokenId ||
      !tenantId
    ) {
      return null;
    }

    const update = {
      lastUsedAt: new Date(),
    };

    if (
      metadata.ip !== undefined
    ) {
      update.lastUsedIp =
        normalizeString(
          metadata.ip,
          MAX_IP_LENGTH
        );
    }

    if (
      metadata.userAgent !== undefined
    ) {
      update.lastUsedUserAgent =
        normalizeString(
          metadata.userAgent,
          MAX_USER_AGENT_LENGTH
        );
    }

    return this.findOneAndUpdate(
      {
        id: tokenId,
        tenantId,
        revokedAt: null,
        expiresAt: {
          $gt: new Date(),
        },
      },
      {
        $set: update,
      },
      {
        new: true,
      }
    );
  };

// ============================================================================
// Statics: Device Sessions
// ============================================================================

/**
 * Find active sessions for a particular device.
 */
RefreshTokenSchema.statics.findActiveByDevice =
  function findActiveByDevice(
    userId,
    deviceId,
    options = {}
  ) {
    if (
      !userId ||
      !deviceId
    ) {
      return this.find({
        _id: null,
      });
    }

    const query = {
      userId,
      "deviceInfo.deviceId":
        String(deviceId),
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    };

    if (options.tenantId) {
      query.tenantId =
        options.tenantId;
    }

    return this.find(query).sort({
      lastUsedAt: -1,
    });
  };

/**
 * Revoke all sessions for one device.
 */
RefreshTokenSchema.statics.revokeDevice =
  function revokeDevice(
    userId,
    deviceId,
    reason = "device_revoked",
    options = {}
  ) {
    if (
      !userId ||
      !deviceId
    ) {
      return {
        acknowledged: false,
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    const query = {
      userId,
      "deviceInfo.deviceId":
        String(deviceId),
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    };

    if (options.tenantId) {
      query.tenantId =
        options.tenantId;
    }

    return this.updateMany(
      query,
      {
        $set: {
          revokedAt: new Date(),
          revokedReason:
            normalizeReason(reason),
        },
      }
    );
  };

// ============================================================================
// Statics: Housekeeping
// ============================================================================

/**
 * MongoDB TTL handles normal expiration.
 *
 * This explicit cleanup operation is useful for administrative jobs,
 * emergency cleanup and environments where operators want deterministic
 * purging.
 */
RefreshTokenSchema.statics.purgeExpired =
  function purgeExpired(
    before = new Date()
  ) {
    const normalized =
      normalizeDate(before) ||
      new Date();

    return this.deleteMany({
      expiresAt: {
        $lt: normalized,
      },
    });
  };

/**
 * Backwards-compatible cleanup alias.
 */
RefreshTokenSchema.statics.purgeExpiredRevoked =
  function purgeExpiredRevoked(
    before = new Date()
  ) {
    const normalized =
      normalizeDate(before) ||
      new Date();

    return this.deleteMany({
      expiresAt: {
        $lt: normalized,
      },
      revokedAt: {
        $ne: null,
      },
    });
  };

// ============================================================================
// Security Helpers
// ============================================================================

RefreshTokenSchema.statics.hashToken =
  hashToken;

RefreshTokenSchema.statics.hashesEqual =
  hashesEqual;

RefreshTokenSchema.statics.generatePublicId =
  generatePublicId;

RefreshTokenSchema.statics.generateTokenFamilyId =
  generateTokenFamilyId;

// ============================================================================
// Model
// ============================================================================

module.exports =
  mongoose.models.RefreshToken ||
  mongoose.model(
    "RefreshToken",
    RefreshTokenSchema
  );