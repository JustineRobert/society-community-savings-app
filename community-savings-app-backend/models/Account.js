'use strict';

/**
 * ============================================================================
 * ACCOUNT MODEL
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Multi-Tenant
 * ✅ Double Entry Ledger Ready
 * ✅ Savings Accounts
 * ✅ Shares Accounts
 * ✅ Fixed Deposit Accounts
 * ✅ Loan Accounts
 * ✅ Wallet Accounts
 * ✅ MoMo Settlement Accounts
 * ✅ Audit Ready
 * ✅ BoU Reporting Ready
 * ✅ Investor Reporting Ready
 * ✅ Board Dashboard Ready
 * ============================================================================
 */

const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema(
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
     * RELATIONSHIPS
     * ========================================================================
     */

    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        index: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    /**
     * ========================================================================
     * ACCOUNT IDENTIFICATION
     * ========================================================================
     */

    accountNumber: {
        type: String,
        required: true,
        trim: true
    },

    accountName: {
        type: String,
        required: true,
        trim: true
    },

    /**
     * ========================================================================
     * ACCOUNT TYPE
     * ========================================================================
     */

    accountType: {
        type: String,
        enum: [
            'SAVINGS',
            'SHARES',
            'FIXED_DEPOSIT',
            'LOAN',
            'WALLET',
            'SETTLEMENT',
            'GL'
        ],
        required: true
    },

    accountCategory: {
        type: String,
        enum: [
            'ASSET',
            'LIABILITY',
            'EQUITY',
            'INCOME',
            'EXPENSE'
        ],
        required: true
    },

    /**
     * ========================================================================
     * BALANCES
     * ========================================================================
     */

    balance: {
        type: Number,
        default: 0,
        min: 0
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

    accruedInterest: {
        type: Number,
        default: 0,
        min: 0
    },

    /**
     * ========================================================================
     * LOAN ACCOUNTS
     * ========================================================================
     */

    outstandingPrincipal: {
        type: Number,
        default: 0
    },

    outstandingInterest: {
        type: Number,
        default: 0
    },

    penaltyBalance: {
        type: Number,
        default: 0
    },

    /**
     * ========================================================================
     * FIXED DEPOSIT
     * ========================================================================
     */

    maturityDate: Date,

    interestRate: {
        type: Number,
        default: 0
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

    sanctionsScreened: {
        type: Boolean,
        default: false
    },

    /**
     * ========================================================================
     * AUDIT
     * ========================================================================
     */

    lastTransactionAt: Date,

    openedAt: {
        type: Date,
        default: Date.now
    },

    closedAt: Date,

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

AccountSchema.index({
    tenantId: 1,
    accountNumber: 1
}, {
    unique: true
});

AccountSchema.index({
    tenantId: 1,
    member: 1
});

AccountSchema.index({
    tenantId: 1,
    accountType: 1
});

AccountSchema.index({
    tenantId: 1,
    status: 1
});

AccountSchema.index({
    tenantId: 1,
    balance: -1
});

AccountSchema.index({
    tenantId: 1,
    createdAt: -1
});

AccountSchema.index({
    tenantId: 1,
    lastTransactionAt: -1
});

/**
 * ============================================================================
 * VIRTUALS
 * ============================================================================
 */

AccountSchema.virtual('isActive')
.get(function () {
    return this.status === 'ACTIVE';
});

AccountSchema.virtual('isDormant')
.get(function () {
    return this.status === 'DORMANT';
});

AccountSchema.virtual('totalExposure')
.get(function () {

    return (
        (this.outstandingPrincipal || 0) +
        (this.outstandingInterest || 0) +
        (this.penaltyBalance || 0)
    );
});

/**
 * ============================================================================
 * MIDDLEWARE
 * ============================================================================
 */

AccountSchema.pre(
    'save',
    function(next) {

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
        'Account',
        AccountSchema
    );