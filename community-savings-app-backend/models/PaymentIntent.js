// models/PaymentIntent.js
'use strict';

const mongoose = require('mongoose');

const PaymentIntentSchema = new mongoose.Schema(
  {
    intentId: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // remove inline index
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: [0, 'Amount must be non-negative'],
      get: v => (v ? parseFloat(v.toString()) : 0),
      set: v => mongoose.Types.Decimal128.fromString(Number(v || 0).toFixed(2)),
    },
    currency: { type: String, default: 'KES', uppercase: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
      default: 'pending',
    }, // remove inline index
    provider: { type: String, required: true, trim: true }, // remove inline index
    metadata: {
      requestId: { type: String, trim: true }, // remove inline index
      providerResponse: { type: mongoose.Schema.Types.Mixed },
      extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    idempotencyKey: { type: String, trim: true }, // remove inline index
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    clientData: { type: mongoose.Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false }, // remove inline index
  },
  { timestamps: true, versionKey: false, toJSON: { getters: true }, toObject: { getters: true } }
);

// ✅ Centralized index definitions
PaymentIntentSchema.index({ user: 1, status: 1, createdAt: -1 });
PaymentIntentSchema.index({ provider: 1, status: 1, createdAt: -1 });
PaymentIntentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
PaymentIntentSchema.index({ isDeleted: 1 });
PaymentIntentSchema.index({ 'metadata.requestId': 1 });

module.exports = mongoose.model('PaymentIntent', PaymentIntentSchema);
