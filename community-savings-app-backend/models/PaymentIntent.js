// models/PaymentIntent.js
'use strict';

const mongoose = require('mongoose');

const PaymentIntentSchema = new mongoose.Schema(
  {
    intentId: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
      index: true,
    },
    provider: { type: String, required: true, trim: true, index: true },
    metadata: {
      requestId: { type: String, trim: true },
      providerResponse: { type: mongoose.Schema.Types.Mixed },
      extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    idempotencyKey: { type: String, index: true },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    clientData: { type: mongoose.Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, toJSON: { getters: true }, toObject: { getters: true } }
);

// Indexes
PaymentIntentSchema.index({ user: 1, status: 1, createdAt: -1 });
PaymentIntentSchema.index({ provider: 1, status: 1, createdAt: -1 });
PaymentIntentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Static & instance helpers (see above)

module.exports = mongoose.model('PaymentIntent', PaymentIntentSchema);
