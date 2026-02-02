// models/Payment.js
// ============================================================================
// Payment Model - Mobile Money Transactions (MTN, Airtel)
// - Tracks all payment transactions with full audit trail
// - Supports multiple providers, currencies, and states
// - Implements secure transaction management
// ============================================================================

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    // Transaction Reference
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      describe: 'Unique transaction identifier'
    },

    // User & Context
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },

    contributionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contribution',
      required: false,
    },

    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: false,
    },

    // Payment Details
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than 0'],
    },

    currency: {
      type: String,
      enum: ['XAF', 'EUR', 'USD', 'NGN', 'GHS', 'KES'],
      default: 'XAF',
      required: true,
    },

    provider: {
      type: String,
      enum: ['MTN_MOMO', 'AIRTEL_MONEY', 'STRIPE', 'PAYPAL'],
      required: true,
      index: true,
    },

    // Phone number for mobile money
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: 'Phone number must be in E.164 format',
      },
    },

    // Payment Status
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },

    // Provider Response Details
    providerReference: {
      type: String,
      trim: true,
      sparse: true,
    },

    providerStatus: {
      type: String,
      trim: true,
      sparse: true,
    },

    // Metadata
    metadata: {
      description: String,
      paymentMethod: String,
      deviceId: String,
      ipAddress: String,
      userAgent: String,
    },

    // Error Tracking
    error: {
      code: String,
      message: String,
      details: mongoose.Schema.Types.Mixed,
      timestamp: Date,
    },

    // Audit
    initiatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    confirmedAt: Date,
    failedAt: Date,
    refundedAt: Date,

    refundAmount: {
      type: Number,
      min: 0,
      sparse: true,
    },

    refundReason: {
      type: String,
      trim: true,
      sparse: true,
    },

    // Idempotency
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Retry Info
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastRetryAt: Date,
    nextRetryAt: Date,

    // Security
    encrypted: {
      type: Boolean,
      default: false,
    },

    verificationToken: String,
    verificationAttempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    index: { userId: 1, createdAt: -1 },
  }
);

// Indexes for efficient querying
paymentSchema.index({ transactionId: 1, provider: 1 });
paymentSchema.index({ groupId: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ initiatedAt: -1 });

// Virtual for display amount with currency
paymentSchema.virtual('displayAmount').get(function () {
  return `${this.currency} ${this.amount.toFixed(2)}`;
});

// Method to mark as completed
paymentSchema.methods.markCompleted = async function (providerRef, providerStatus) {
  this.status = 'COMPLETED';
  this.providerReference = providerRef;
  this.providerStatus = providerStatus;
  this.confirmedAt = new Date();
  return this.save();
};

// Method to mark as failed
paymentSchema.methods.markFailed = async function (errorCode, errorMessage, errorDetails = {}) {
  this.status = 'FAILED';
  this.failedAt = new Date();
  this.error = {
    code: errorCode,
    message: errorMessage,
    details: errorDetails,
    timestamp: new Date(),
  };
  return this.save();
};

// Method for refund
paymentSchema.methods.refund = async function (refundAmount, refundReason) {
  if (this.status !== 'COMPLETED') {
    throw new Error('Only completed payments can be refunded');
  }
  if (refundAmount > this.amount) {
    throw new Error('Refund amount cannot exceed original payment amount');
  }
  this.status = 'REFUNDED';
  this.refundAmount = refundAmount;
  this.refundReason = refundReason;
  this.refundedAt = new Date();
  return this.save();
};

// Method to check if can retry
paymentSchema.methods.canRetry = function () {
  return (
    this.status === 'PENDING' &&
    this.retryCount < 5 &&
    (!this.nextRetryAt || this.nextRetryAt <= new Date())
  );
};

// Middleware: Validate status transitions
paymentSchema.pre('save', function (next) {
  const validTransitions = {
    PENDING: ['PROCESSING', 'FAILED', 'CANCELLED'],
    PROCESSING: ['COMPLETED', 'FAILED', 'PENDING'],
    COMPLETED: ['REFUNDED'],
    FAILED: ['PENDING', 'CANCELLED'],
    CANCELLED: [],
    REFUNDED: [],
  };

  if (this.isNew || this.isModified('status')) {
    const previousStatus = this.constructor.findById(this._id);
    if (previousStatus) {
      const allowed = validTransitions[previousStatus.status] || [];
      if (!allowed.includes(this.status)) {
        next(new Error(`Invalid status transition from ${previousStatus.status} to ${this.status}`));
        return;
      }
    }
  }

  next();
});

// Ensure indexes are created
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ groupId: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
