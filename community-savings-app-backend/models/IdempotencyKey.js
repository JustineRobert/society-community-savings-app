// models/IdempotencyKey.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const IdempotencyKeySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    tenantId: { type: String, index: true }, // optional multi-tenant scope
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, index: true }, // TTL expiry
    metadata: {
      requestId: { type: String, trim: true },
      endpoint: { type: String, trim: true },
      payloadHash: { type: String, trim: true },
      extra: { type: Schema.Types.Mixed, default: {} },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { versionKey: false }
);

// TTL index: auto-delete expired keys
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static helpers
IdempotencyKeySchema.statics.recordKey = async function (key, metadata = {}, ttlSeconds = 86400) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  return this.create({ key, metadata, expiresAt });
};

IdempotencyKeySchema.statics.exists = async function (key) {
  return this.findOne({ key, isDeleted: false });
};

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
