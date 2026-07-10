'use strict';

/**
 * ============================================================================
 * SAVINGS MODEL
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Central savings portfolio management.
 *
 * Supports:
 *
 * ✅ Multi-Tenant Savings Management
 * ✅ Savings Accounts
 * ✅ Interest Accrual
 * ✅ Goal Savings
 * ✅ Savings Analytics
 * ✅ Mobile Money Deposits
 * ✅ Mobile Money Withdrawals
 * ✅ Board Reporting
 * ✅ Investor Reporting
 * ✅ BoU Reporting
 * ✅ Audit Trail
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Enterprise Validation
 * ✅ Audit Ready
 * ✅ Analytics Ready
 * ✅ Multi-Tenant Isolation
 * ✅ Regulatory Ready
 * ✅ Production Safe
 *
 * ============================================================================
 */

const mongoose = require('mongoose');

/**
 * ============================================================================
 * TRANSACTION SNAPSHOT
 * ============================================================================
 */

const SavingsActivitySchema = new mongoose.Schema(
{
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },

    type: {
        type: String,
        enum: [
            'DEPOSIT',
            'WITHDRAWAL',
            'INTEREST',
            'DIVIDEND',
            'ADJUSTMENT'
        ]
    },

    amount: {
        type: Number,
        default: 0,
        min: 0
    },

    transactionDate: {
        type: Date,
        default: Date.now
    },

    reference: String
},
{
    _id: false
}
);

/**
 * ============================================================================
 * SAVINGS SCHEMA
 * ============================================================================
 */

const SavingsSchema = new mongoose.Schema(
{
    /**
     * ========================================================================
     * MULTI TENANCY
     * ========================================================================
     */

    tenantId: {
        type: String,
        required: true,
        index: true
    },

    /**
     * ========================================================================
     * MEMBER
     * ========================================================================
     */

    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
        index: true
    },

    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account'
    },

    /**
     * ========================================================================
     * SAVINGS IDENTIFICATION
     * ========================================================================
     */

    savingsNumber: {
        type: String,
        required: true,
        trim: true
    },

    savingsName: {
        type: String,
        default: 'Regular Savings'
    },

    /**
     * ========================================================================
     * SAVINGS TYPE
     * ========================================================================
     */

    savingsType: {
        type: String,
        enum: [
            'REGULAR',
            'GOAL',
            'FIXED',
            'CHILD',
            'GROUP',
            'INVESTMENT'
        ],
        default: 'REGULAR'
    },

    /**
     * ========================================================================
     * BALANCES
     * ========================================================================
     */

    balance: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator(value) {
                return value >= 0;
            },
            message: 'Balance cannot be negative'
        }
    },

    availableBalance: {
        type: Number,
        default: 0,
        min: 0
    },

    blockedBalance: {
        type: Number,
        default: 0,
        min: 0
    },

    /**
     * ========================================================================
     * SAVINGS ANALYTICS
     * ========================================================================
     */

    totalDeposits: {
        type: Number,
        default: 0
    },

    totalWithdrawals: {
        type: Number,
        default: 0
    },

    netSavings: {
        type: Number,
        default: 0
    },

    totalTransactions: {
        type: Number,
        default: 0
    },

    /**
     * ========================================================================
     * INTEREST MANAGEMENT
     * ========================================================================
     */

    interestRate: {
        type: Number,
        default: 0
    },

    accruedInterest: {
        type: Number,
        default: 0
    },

    interestLastCalculatedAt: Date,

    /**
     * ========================================================================
     * DIVIDENDS
     * ========================================================================
     */

    dividendEligible: {
        type: Boolean,
        default: true
    },

    totalDividendsEarned: {
        type: Number,
        default: 0
    },

    /**
     * ========================================================================
     * SAVINGS TARGETS
     * ========================================================================
     */

    targetAmount: {
        type: Number,
        default: 0
    },

    maturityDate: Date,

    /**
     * ========================================================================
     * MOBILE MONEY
     * ========================================================================
     */

    momoEnabled: {
        type: Boolean,
        default: false
    },

    momoProvider: {
        type: String,
        enum: [
            'MTN',
            'AIRTEL'
        ]
    },

    /**
     * ========================================================================
     * COMPLIANCE
     * ========================================================================
     */

    kycVerified: {
        type: Boolean,
        default: false
    },

    amlChecked: {
        type: Boolean,
        default: false
    },

    /**
     * ========================================================================
     * STATUS
     * ========================================================================
     */

    status: {
        type: String,
        enum: [
            'PENDING',
            'ACTIVE',
            'DORMANT',
            'BLOCKED',
            'CLOSED'
        ],
        default: 'ACTIVE'
    },

    /**
     * ========================================================================
     * RISK
     * ========================================================================
     */

    fraudFlagged: {
        type: Boolean,
        default: false
    },

    riskScore: {
        type: Number,
        default: 0
    },

    /**
     * ========================================================================
     * ACTIVITY
     * ========================================================================
     */

    recentActivities: [SavingsActivitySchema],

    /**
     * ========================================================================
     * AUDIT
     * ========================================================================
     */

    lastDepositAt: Date,

    lastWithdrawalAt: Date,

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    auditReference: {
        type: String,
        trim: true
    },

    workflowVersion: {
        type: Number,
        default: 1
    }
},
{
    timestamps: true,
    versionKey: false,

    toJSON: {
        virtuals: true,
        transform(doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            return ret;
        }
    },

    toObject: {
        virtuals: true
    }
}
);

/**
 * ============================================================================
 * INDEXES
 * ============================================================================
 */

SavingsSchema.index({
    tenantId: 1,
    savingsNumber: 1
}, {
    unique: true
});

SavingsSchema.index({
    tenantId: 1,
    member: 1
});

SavingsSchema.index({
    tenantId: 1,
    savingsType: 1
});

SavingsSchema.index({
    tenantId: 1,
    status: 1
});

SavingsSchema.index({
    tenantId: 1,
    balance: -1
});

SavingsSchema.index({
    tenantId: 1,
    fraudFlagged: 1
});

SavingsSchema.index({
    tenantId: 1,
    riskScore: -1
});

SavingsSchema.index({
    tenantId: 1,
    createdAt: -1
});

/**
 * ============================================================================
 * VIRTUALS
 * ============================================================================
 */

SavingsSchema.virtual('isActive')
.get(function () {
    return this.status === 'ACTIVE';
});

SavingsSchema.virtual('isDormant')
.get(function () {
    return this.status === 'DORMANT';
});

SavingsSchema.virtual('goalAchievementPercentage')
.get(function () {

    if (!this.targetAmount) {
        return 0;
    }

    return (
        this.balance /
        this.targetAmount
    ) * 100;
});

/**
 * ============================================================================
 * MIDDLEWARE
 * ============================================================================
 */

SavingsSchema.pre(
    'save',
    function(next) {

        this.netSavings =
            Math.max(
                0,
                (this.totalDeposits || 0) -
                (this.totalWithdrawals || 0)
            );

        if (
            this.availableBalance >
            this.balance
        ) {
            this.availableBalance =
                this.balance;
        }

        next();
    }
);

/**
 * ============================================================================
 * EXPORT
 * ============================================================================
 */

module.exports =
    mongoose.model(
        'Savings',
        SavingsSchema
    );