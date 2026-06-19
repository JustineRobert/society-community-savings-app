// models/IdempotencyKey.js
const IdempotencyKeySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    tenantId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, index: true },
    metadata: {
      requestId: { type: String, trim: true }, // do NOT add index: true here if you also index at schema level
      endpoint: { type: String, trim: true },
      payloadHash: { type: String, trim: true },
      extra: { type: Schema.Types.Mixed, default: {} },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { versionKey: false }
);

IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
