//  backend/modules/finance/models/LedgerEntry.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * CONSTANTS
 */
const ENTRY_TYPES = ['DEBIT', 'CREDIT'];

/**
 * SCHEMA
 */
const LedgerEntrySchema = new Schema(
  {
    /**
     * Multi-tenant isolation
     */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'tenantId is required'],
      index: true,
    },

    /**
     * Link to transaction
     */
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'transactionId is required'],
      index: true,
    },

    /**
     * Account reference (GL layer)
     */
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'accountId is required'],
      index: true,
    },

    /**
     * Debit or Credit
     */
    type: {
      type: String,
      enum: ENTRY_TYPES,
      required: [true, 'Entry type is required'],
      uppercase: true,
      trim: true,
      index: true,
    },

    /**
     * Financial amount
     */
    amount: {
      type: Schema.Types.Decimal128,
      required: [true, 'amount is required'],
      validate: {
        validator: function (v) {
          if (!v) return false;
          const n = parseFloat(v.toString());
          return Number.isFinite(n) && n > 0;
        },
        message: 'Amount must be a positive number',
      },
      get: (v) => (v ? parseFloat(v.toString()) : 0),
      set: (v) =>
        mongoose.Types.Decimal128.fromString(
          Number(v || 0).toFixed(2)
        ),
    },

    currency: {
      type: String,
      default: 'UGX',
      uppercase: true,
      trim: true,
      maxlength: [3, 'currency must be a 3-letter ISO code'],
      index: true,
    },

    /**
     * Business reference
     */
    reference: {
      type: String,
      trim: true,
      maxlength: 128,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1024,
    },

    /**
     * External integrations
     */
    momoTransactionId: {
      type: String,
      trim: true,
      maxlength: 128,
      index: true,
    },

    provider: {
      type: String,
      trim: true,
      uppercase: true,
    },

    /**
     * Distributed tracing (CRITICAL)
     */
    requestId: {
      type: String,
      trim: true,
      index: true,
    },

    /**
     * Soft delete (audit safe)
     */
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    /**
     * Audit metadata
     */
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

/**
 * INDEXES (Performance + Multi-tenant)
 */
LedgerEntrySchema.index({ tenantId: 1, transactionId: 1 });
LedgerEntrySchema.index({ tenantId: 1, accountId: 1 });
LedgerEntrySchema.index({ tenantId: 1, type: 1 });
LedgerEntrySchema.index({ tenantId: 1, currency: 1, deletedAt: 1 });

/**
 * HOOKS
 */
LedgerEntrySchema.pre('save', function (next) {
  if (this.type) this.type = String(this.type).toUpperCase();
  if (this.currency) this.currency = String(this.currency).toUpperCase();
  next();
});

/**
 * METHODS
 */

// Check if deleted
LedgerEntrySchema.methods.isDeleted = function () {
  return !!this.deletedAt;
};

// Soft delete
LedgerEntrySchema.methods.softDelete = async function () {
  if (!this.deletedAt) {
    this.deletedAt = new Date();
    await this.save();
  }
  return this;
};

/**
 * STATIC METHODS
 */

// ✅ Enforce double-entry accounting
LedgerEntrySchema.statics.validateDoubleEntry = function (entries) {
  const debit = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const credit = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  if (debit !== credit) {
    throw new Error('Ledger imbalance: debit must equal credit');
  }
};

// ✅ Post transaction (core engine)
LedgerEntrySchema.statics.postTransaction = async function ({
  tenantId,
  transactionId,
  debitAccountId,
  creditAccountId,
  amount,
  currency = 'UGX',
  reference = null,
  description = null,
  requestId = null,
  provider = null,
  momoTransactionId = null,
}) {
  const entries = [
    {
      tenantId,
      transactionId,
      accountId: debitAccountId,
      type: 'DEBIT',
      amount,
      currency,
      reference,
      description,
      requestId,
      provider,
      momoTransactionId,
    },
    {
      tenantId,
      transactionId,
      accountId: creditAccountId,
      type: 'CREDIT',
      amount,
      currency,
      reference,
      description,
      requestId,
      provider,
      momoTransactionId,
    },
  ];

  this.validateDoubleEntry(entries);

  return this.insertMany(entries);
};

/**
 * FINANCIAL REPORTS CORE
 */

// ✅ Trial Balance
LedgerEntrySchema.statics.getTrialBalance = async function (tenantId) {
  return this.aggregate([
    { $match: { tenantId, deletedAt: null } },
    {
      $group: {
        _id: {
          accountId: '$accountId',
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
  ]);
};

// ✅ Account Balance
LedgerEntrySchema.statics.getAccountBalance = async function (
  tenantId,
  accountId
) {
  const result = await this.aggregate([
    {
      $match: {
        tenantId,
        accountId: mongoose.Types.ObjectId(accountId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      },
    },
  ]);

  let debit = 0;
  let credit = 0;

  result.forEach((r) => {
    if (r._id === 'DEBIT') debit = r.total;
    if (r._id === 'CREDIT') credit = r.total;
  });

  return debit - credit;
};

/**
 * EXPORT
 */
const LedgerEntry =
  mongoose.models.LedgerEntry ||
  mongoose.model('LedgerEntry', LedgerEntrySchema);

module.exports = LedgerEntry;