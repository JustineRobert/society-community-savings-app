// ============================================================================
// backend/models/Transaction.js
// ============================================================================
// TITech Community Capital
// Enterprise Transaction Ledger
//
// Supports:
// - MTN MoMo Collections
// - MTN MoMo Disbursements
// - Savings Deposits
// - Loan Repayments
// - Withdrawals
// - Settlements
// - Reconciliation
// - Audit Logging
// - Accounting Integrations
//
// Production Grade
// ============================================================================

"use strict";

const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * ============================================================================
 * ENUMS
 * ============================================================================
 */

const TRANSACTION_STATUS = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REVERSED",
  "SETTLED",
];

const TRANSACTION_TYPE = [
  "DEPOSIT",
  "WITHDRAWAL",
  "LOAN_DISBURSEMENT",
  "LOAN_REPAYMENT",
  "CONTRIBUTION",
  "SETTLEMENT",
  "TRANSFER",
  "REFUND",
];

const FLOW_TYPES = [
  "credit",
  "debit",
];

const PROVIDERS = [
  "mtn_momo",
  "airtel_money",
  "bank",
  "cash",
  "internal",
];

/**
 * ============================================================================
 * TRANSACTION SCHEMA
 * ============================================================================
 */

const transactionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      index: true,
    },

    loanId: {
      type: Schema.Types.ObjectId,
      ref: "Loan",
      index: true,
    },

    contributionId: {
      type: Schema.Types.ObjectId,
      ref: "Contribution",
      index: true,
    },

    /**
     * Provider Reference IDs
     */

    externalId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      trim: true,
    },

    providerReferenceId: {
      type: String,
      index: true,
      trim: true,
    },

    providerTransactionId: {
      type: String,
      index: true,
      trim: true,
    },

    settlementId: {
      type: String,
      index: true,
      trim: true,
    },

    /**
     * Transaction Classification
     */

    transactionType: {
      type: String,
      enum: TRANSACTION_TYPE,
      default: "DEPOSIT",
      index: true,
    },

    flow: {
      type: String,
      enum: FLOW_TYPES,
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: PROVIDERS,
      default: "internal",
      index: true,
    },

    /**
     * Financial Data
     */

    amount: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    fees: {
      type: Number,
      default: 0,
      min: 0,
    },

    netAmount: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "UGX",
      uppercase: true,
      trim: true,
      maxlength: 10,
    },

    /**
     * Parties
     */

    phone: {
      type: String,
      trim: true,
      index: true,
    },

    accountNumber: {
      type: String,
      trim: true,
    },

    beneficiaryName: {
      type: String,
      trim: true,
    },

    /**
     * Status
     */

    status: {
      type: String,
      enum: TRANSACTION_STATUS,
      default: "PENDING",
      index: true,
    },

    statusReason: {
      type: String,
      trim: true,
    },

    /**
     * Reconciliation
     */

    reconciled: {
      type: Boolean,
      default: false,
      index: true,
    },

    reconciledAt: {
      type: Date,
    },

    settlementDate: {
      type: Date,
    },

    /**
     * Accounting
     */

    accountingPosted: {
      type: Boolean,
      default: false,
      index: true,
    },

    accountingPostedAt: {
      type: Date,
    },

    ledgerReference: {
      type: String,
      trim: true,
    },

    /**
     * Metadata
     */

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    /**
     * Audit
     */

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * ============================================================================
 * PRE SAVE
 * ============================================================================
 */

transactionSchema.pre("save", function (next) {
  this.netAmount = Number(this.amount || 0) - Number(this.fees || 0);
  next();
});

/**
 * ============================================================================
 * INSTANCE METHODS
 * ============================================================================
 */

transactionSchema.methods.markSuccessful = async function () {
  this.status = "SUCCESS";
  return this.save();
};

transactionSchema.methods.markFailed = async function (reason) {
  this.status = "FAILED";
  this.statusReason = reason;
  return this.save();
};

transactionSchema.methods.markReconciled = async function () {
  this.reconciled = true;
  this.reconciledAt = new Date();
  return this.save();
};

/**
 * ============================================================================
 * STATIC METHODS
 * ============================================================================
 */

transactionSchema.statics.findByExternalId = function (externalId) {
  return this.findOne({ externalId });
};

transactionSchema.statics.findPending = function () {
  return this.find({
    status: "PENDING",
  });
};

transactionSchema.statics.findUnreconciled = function () {
  return this.find({
    reconciled: false,
  });
};

/**
 * ============================================================================
 * INDEXES
 * ============================================================================
 */

transactionSchema.index({
  createdAt: -1,
});

transactionSchema.index({
  status: 1,
  createdAt: -1,
});

transactionSchema.index({
  provider: 1,
  status: 1,
});

transactionSchema.index({
  externalId: 1,
});

transactionSchema.index({
  providerTransactionId: 1,
});

transactionSchema.index({
  reconciled: 1,
});

transactionSchema.index({
  tenantId: 1,
  createdAt: -1,
});

/**
 * ============================================================================
 * EXPORT
 * ============================================================================
 */

module.exports =
  mongoose.models.Transaction ||
  mongoose.model(
    "Transaction",
    transactionSchema
  );
