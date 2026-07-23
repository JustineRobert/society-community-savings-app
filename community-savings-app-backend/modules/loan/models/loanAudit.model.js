"use strict";

const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * ============================================================
 * TITech Community Capital LTD
 * Loan Audit Model
 * ============================================================
 * Enterprise Audit Trail
 *
 * Tracks:
 * - Eligibility Assessments
 * - Applications
 * - Approvals
 * - Rejections
 * - Overrides
 * - Disbursements
 * - Repayments
 * - Defaults
 * - Write-offs
 * - Restructuring
 * - Custom Workflow Events
 *
 * Compliance:
 * - Multi-tenant
 * - Immutable audit records
 * - Regulatory reporting
 * - Risk monitoring
 *
 * ============================================================
 */

const LoanAuditSchema = new Schema(
    {
        /**
         * Multi Tenant Isolation
         */
        tenantId: {
            type: String,
            required: true,
            trim: true
        },

        /**
         * SACCO / Group Reference
         */
        groupId: {
            type: Schema.Types.ObjectId,
            ref: "Group",
            default: null
        },

        /**
         * Member Reference
         */
        memberId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        /**
         * Loan Reference
         */
        loanId: {
            type: Schema.Types.ObjectId,
            ref: "Loan",
            required: true
        },

        /**
         * User initiating action
         */
        actorId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        /**
         * System / API / USER
         */
        actorType: {
            type: String,
            enum: [
                "USER",
                "ADMIN",
                "SYSTEM",
                "API",
                "SERVICE"
            ],
            default: "SYSTEM"
        },

        /**
         * Event Type
         */
        eventType: {
            type: String,
            required: true,
            enum: [
                "ELIGIBILITY_ASSESSMENT",

                "LOAN_APPLICATION_CREATED",

                "LOAN_APPLICATION_UPDATED",

                "LOAN_APPROVED",

                "LOAN_REJECTED",

                "LOAN_CANCELLED",

                "LOAN_DISBURSED",

                "LOAN_REPAYMENT",

                "LOAN_DEFAULTED",

                "LOAN_WRITTEN_OFF",

                "LOAN_RESTRUCTURED",

                "ADMIN_OVERRIDE",

                "CUSTOM_EVENT"
            ]
        },

        /**
         * Risk Score
         */
        score: {
            type: Number,
            default: null
        },

        /**
         * Eligibility Result
         */
        eligible: {
            type: Boolean,
            default: null
        },

        /**
         * Detailed score explanation
         */
        breakdown: {
            type: Schema.Types.Mixed,
            default: null
        },

        /**
         * Loan Amount
         */
        amount: {
            type: Number,
            min: 0,
            default: null
        },

        /**
         * Currency
         */
        currency: {
            type: String,
            default: "UGX",
            uppercase: true,
            trim: true
        },

        /**
         * Interest Rate Snapshot
         */
        interestRate: {
            type: Number,
            default: null
        },

        /**
         * Mobile Money / Bank Txn
         */
        transactionId: {
            type: String,
            trim: true,
            default: null
        },

        /**
         * External Provider
         */
        provider: {
            type: String,
            enum: [
                "MTN_MOMO",
                "AIRTEL_MONEY",
                "BANK",
                "CASH",
                "MANUAL",
                "OTHER"
            ],
            default: "OTHER"
        },

        /**
         * Status Before Action
         */
        previousStatus: {
            type: String,
            default: null
        },

        /**
         * Status After Action
         */
        currentStatus: {
            type: String,
            default: null
        },

        /**
         * Reason
         */
        reason: {
            type: String,
            maxlength: 5000,
            default: null
        },

        /**
         * Additional Comments
         */
        remarks: {
            type: String,
            maxlength: 5000,
            default: null
        },

        /**
         * Request IP
         */
        ipAddress: {
            type: String,
            default: null
        },

        /**
         * Device Metadata
         */
        userAgent: {
            type: String,
            default: null
        },

        /**
         * Correlation Tracking
         */
        correlationId: {
            type: String,
            default: null
        },

        /**
         * Idempotency Key
         */
        idempotencyKey: {
            type: String,
            default: null
        },

        /**
         * Arbitrary Metadata
         */
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        },

        /**
         * Immutable Record
         */
        immutableHash: {
            type: String,
            default: null
        },

        /**
         * Soft Delete Protection
         */
        isArchived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,

        versionKey: false,

        collection: "loan_audits",

        minimize: false
    }
);

/**
 * ============================================================
 * INDEXES
 * ============================================================
 */

/**
 * Tenant Isolation
 */
LoanAuditSchema.index({
    tenantId: 1
});

/**
 * Loan Trail Lookup
 */
LoanAuditSchema.index({
    loanId: 1
});

/**
 * Member History
 */
LoanAuditSchema.index({
    memberId: 1
});

/**
 * Event Analytics
 */
LoanAuditSchema.index({
    eventType: 1
});

/**
 * Idempotent Transaction Lookup
 */
LoanAuditSchema.index({
    transactionId: 1
});

/**
 * Audit Timeline Queries
 */
LoanAuditSchema.index({
    createdAt: -1
});

/**
 * Most Common Query
 */
LoanAuditSchema.index({
    tenantId: 1,
    loanId: 1,
    createdAt: -1
});

/**
 * Risk History
 */
LoanAuditSchema.index({
    tenantId: 1,
    memberId: 1,
    createdAt: -1
});

/**
 * Workflow Analytics
 */
LoanAuditSchema.index({
    tenantId: 1,
    eventType: 1,
    createdAt: -1
});

/**
 * Transaction Audit Search
 */
LoanAuditSchema.index({
    transactionId: 1,
    tenantId: 1
});

/**
 * ============================================================
 * IMMUTABILITY ENFORCEMENT
 * ============================================================
 */

LoanAuditSchema.pre("save", function(next) {
    this.wasNew = this.isNew;
    next();
});

LoanAuditSchema.pre(
    "findOneAndUpdate",
    function() {
        throw new Error(
            "Loan audit records are immutable"
        );
    }
);

LoanAuditSchema.pre(
    "updateOne",
    function() {
        throw new Error(
            "Loan audit records are immutable"
        );
    }
);

LoanAuditSchema.pre(
    "deleteOne",
    function() {
        throw new Error(
            "Loan audit records cannot be deleted"
        );
    }
);

/**
 * ============================================================
 * STATIC METHODS
 * ============================================================
 */

LoanAuditSchema.statics.getLoanTimeline =
    function(loanId) {

        return this.find({
            loanId
        })
            .sort({
                createdAt: 1
            })
            .lean();
    };

LoanAuditSchema.statics.getMemberHistory =
    function(memberId, tenantId) {

        return this.find({
            memberId,
            tenantId
        })
            .sort({
                createdAt: -1
            })
            .lean();
    };

LoanAuditSchema.statics.getEventSummary =
    function(tenantId) {

        return this.aggregate([
            {
                $match: {
                    tenantId
                }
            },
            {
                $group: {
                    _id: "$eventType",
                    total: {
                        $sum: 1
                    }
                }
            }
        ]);
    };

/**
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports =
    mongoose.models.LoanAudit ||
    mongoose.model(
        "LoanAudit",
        LoanAuditSchema
    );