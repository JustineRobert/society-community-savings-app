// backend/modules/finance/models/Journal.js
'use strict';

const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema(
  {
    /**
     * Multi-tenant isolation
     */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },

    /**
     * Unique journal reference
     */
    journalId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    /**
     * Linked business transaction
     */
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true
    },

    /**
     * Loan linkage
     */
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      default: null,
      index: true
    },

    /**
     * Savings account linkage
     */
    savingsAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavingsAccount',
      default: null
    },

    /**
     * Human-readable reference
     */
    reference: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500
    },

    /**
     * Accounting totals
     */
    totalDebits: {
      type: Number,
      required: true,
      min: 0
    },

    totalCredits: {
      type: Number,
      required: true,
      min: 0
    },

    balanced: {
      type: Boolean,
      required: true,
      default: true
    },

    /**
     * Currency support
     */
    currency: {
      type: String,
      default: 'UGX',
      index: true
    },

    /**
     * Journal classification
     */
    journalType: {
      type: String,
      enum: [
        'SAVINGS_DEPOSIT',
        'SAVINGS_WITHDRAWAL',
        'LOAN_DISBURSEMENT',
        'LOAN_REPAYMENT',
        'INTEREST_ACCRUAL',
        'PENALTY',
        'FEE',
        'MOMO_SETTLEMENT',
        'AIRTEL_SETTLEMENT',
        'ADJUSTMENT',
        'REVERSAL',
        'WRITE_OFF'
      ],
      required: true,
      index: true
    },

    /**
     * Posting lifecycle
     */
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'POSTED',
        'REVERSED',
        'CANCELLED'
      ],
      default: 'DRAFT',
      index: true
    },

    /**
     * Reconciliation
     */
    reconciliationStatus: {
      type: String,
      enum: [
        'PENDING',
        'MATCHED',
        'DISPUTED',
        'RECONCILED'
      ],
      default: 'PENDING',
      index: true
    },

    reconciledAt: Date,

    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    /**
     * Reversal controls
     */
    reversed: {
      type: Boolean,
      default: false
    },

    reversalJournalId: {
      type: String,
      default: null
    },

    /**
     * Workflow integration
     */
    workflowHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanWorkflowHistory',
      default: null
    },

    /**
     * Audit metadata
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    postedAt: Date,

    /**
     * Blockchain-style integrity
     */
    previousHash: {
      type: String,
      default: null,
      index: true
    },

    hash: {
      type: String,
      required: true,
      index: true
    },

    /**
     * Regulatory exports
     */
    reportingPeriod: {
      type: String,
      default: null
    },

    /**
     * Extensible metadata
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

/**
 * Core Fintech Indexes
 */

JournalSchema.index({
  tenantId: 1,
  journalId: 1
});

JournalSchema.index({
  tenantId: 1,
  transactionId: 1
});

JournalSchema.index({
  tenantId: 1,
  journalType: 1,
  createdAt: -1
});

JournalSchema.index({
  tenantId: 1,
  reconciliationStatus: 1
});

JournalSchema.index({
  tenantId: 1,
  status: 1
});

module.exports = mongoose.model(
  'Journal',
  JournalSchema
);