// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      describe: 'Unique transaction identifier'
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },

    contributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' },

    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },

    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },

    currency: { type: String, enum: ['XAF','EUR','USD','NGN','GHS','KES'], default: 'XAF', required: true },

    provider: { type: String, enum: ['MTN_MOMO','AIRTEL_MONEY','STRIPE','PAYPAL'], required: true, index: true },

    phoneNumber: { type: String, required: true, trim: true, /* validator omitted for brevity */ },

    status: { type: String, enum: ['PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','REFUNDED'], default: 'PENDING', index: true },

    providerReference: { type: String, trim: true, sparse: true },

    providerStatus: { type: String, trim: true, sparse: true },

    metadata: { description: String, paymentMethod: String, deviceId: String, ipAddress: String, userAgent: String },

    error: { code: String, message: String, details: mongoose.Schema.Types.Mixed, timestamp: Date },

    initiatedAt: { type: Date, default: Date.now, index: true },

    confirmedAt: Date,
    failedAt: Date,
    refundedAt: Date,

    refundAmount: { type: Number, min: 0, sparse: true },

    refundReason: { type: String, trim: true, sparse: true },

    idempotencyKey: { type: String, unique: true, sparse: true }, // removed redundant index: true

    retryCount: { type: Number, default: 0, min: 0 },

    lastRetryAt: Date,
    nextRetryAt: Date,

    encrypted: { type: Boolean, default: false },

    verificationToken: String,
    verificationAttempts: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
paymentSchema.index({ transactionId: 1, provider: 1 });
paymentSchema.index({ groupId: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ initiatedAt: -1 });
paymentSchema.index({ userId: 1, createdAt: -1 }); // single canonical definition

paymentSchema.virtual('displayAmount').get(function () {
  return `${this.currency} ${this.amount.toFixed(2)}`;
});

module.exports = mongoose.model('Payment', paymentSchema);
