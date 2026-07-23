"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * File: backend/models/Reconciliation.js
 * Enterprise Reconciliation Model
 * ============================================================================
 */

const mongoose =
    require("mongoose");

const {
    Schema
} = mongoose;

/* ============================================================================
 * TRANSACTION SNAPSHOT
 * ========================================================================== */

const TransactionSnapshotSchema =
    new Schema(

        {

            referenceId: {

                type:
                    String,

                trim:
                    true,

                index:
                    true
            },

            providerTransactionId: {

                type:
                    String,

                trim:
                    true
            },

            accountId: {

                type:
                    String,

                trim:
                    true
            },

            memberId: {

                type:
                    String,

                trim:
                    true
            },

            amount: {

                type:
                    Number,

                default:
                    0
            },

            currency: {

                type:
                    String,

                default:
                    "UGX"
            },

            status: {

                type:
                    String
            },

            transactionDate: {

                type:
                    Date
            },

            metadata: {

                type:
                    Schema.Types.Mixed,

                default:
                    {}
            }

        },

        {
            _id: false
        }
    );

/* ============================================================================
 * MATCHED TRANSACTION
 * ========================================================================== */

const MatchedTransactionSchema =
    new Schema(

        {

            provider: {

                type:
                    TransactionSnapshotSchema
            },

            internal: {

                type:
                    TransactionSnapshotSchema
            }

        },

        {
            _id: false
        }
    );

/* ============================================================================
 * MISMATCH RECORD
 * ========================================================================== */

const MismatchSchema =
    new Schema(

        {

            provider: {

                type:
                    TransactionSnapshotSchema
            },

            internal: {

                type:
                    TransactionSnapshotSchema
            },

            reason: {

                type:
                    String,

                trim:
                    true
            }

        },

        {
            _id: false
        }
    );

/* ============================================================================
 * RECONCILIATION SUMMARY
 * ========================================================================== */

const SummarySchema =
    new Schema(

        {

            matched: {

                type:
                    Number,

                default:
                    0
            },

            missingInternal: {

                type:
                    Number,

                default:
                    0
            },

            missingProvider: {

                type:
                    Number,

                default:
                    0
            },

            mismatches: {

                type:
                    Number,

                default:
                    0
            },

            duplicates: {

                type:
                    Number,

                default:
                    0
            }

        },

        {
            _id: false
        }
    );

/* ============================================================================
 * MAIN RECONCILIATION SCHEMA
 * ========================================================================== */

const ReconciliationSchema =
    new Schema(

        {

            reconciliationId: {

                type:
                    String,

                required:
                    true,

                unique:
                    true,

                index:
                    true
            },

            tenantId: {

                type:
                    String,

                required:
                    true,

                index:
                    true
            },

            provider: {

                type:
                    String,

                required:
                    true,

                enum: [

                    "MTN_MOMO",

                    "AIRTEL_MONEY",

                    "LEDGER",

                    "MANUAL",

                    "ALL"
                ],

                index:
                    true
            },

            reconciliationDate: {

                type:
                    Date,

                required:
                    true,

                index:
                    true
            },

            status: {

                type:
                    String,

                default:
                                      "COMPLETED",

                enum: [

                    "PENDING",

                    "RUNNING",

                    "COMPLETED",

                    "FAILED",

                    "PARTIAL"
                ],

                index:
                    true
            },

            totalProviderTransactions: {

                type:
                    Number,

                default:
                    0
            },

            totalInternalTransactions: {

                type:
                    Number,

                default:
                    0
            },

            matched: [

                MatchedTransactionSchema
            ],

            missingInternal: [

                TransactionSnapshotSchema
            ],

            missingProvider: [

                TransactionSnapshotSchema
            ],

            duplicates: [

                TransactionSnapshotSchema
            ],

            mismatches: [

                MismatchSchema
            ],

            summary: {

                type:
                    SummarySchema,

                default:
                    () => ({})
            },

            isBalanced: {

                type:
                    Boolean,

                default:
                    false,

                index:
                    true
            },

            exceptionCount: {

                type:
                    Number,

                default:
                    0
            },

            generatedBy: {

                type:
                    String,

                trim:
                    true
            },

            approvedBy: {

                type:
                    String,

                trim:
                    true
            },

            approvedAt: {

                type:
                    Date
            },

            notes: {

                type:
                    String,

                trim:
                    true
            },

            metadata: {

                type:
                    Schema.Types.Mixed,

                default:
                    {}
            },

            deleted: {

                type:
                    Boolean,

                default:
                    false,

                index:
                    true
            },

            deletedAt: {

                type:
                    Date
            }

        },

        {

            timestamps:
                true,

            versionKey:
                false
        }
    );

/* ============================================================================
 * INDEXES
 * ========================================================================== */

ReconciliationSchema.index({
    tenantId: 1,
    provider: 1,
    reconciliationDate: -1
});

ReconciliationSchema.index({
    tenantId: 1,
    isBalanced: 1
});

ReconciliationSchema.index({
    tenantId: 1,
    status: 1
});

ReconciliationSchema.index({
    tenantId: 1,
    deleted: 1
});

ReconciliationSchema.index({
    reconciliationId: 1
});

/* ============================================================================
 * VIRTUALS
 * ========================================================================== */

ReconciliationSchema.virtual(
    "hasExceptions"
).get(
    function () {

        return (
            this.exceptionCount > 0
        );
    }
);

/* ============================================================================
 * PRE SAVE HOOK
 * ========================================================================== */

ReconciliationSchema.pre(
    "save",
    function (
        next
    ) {

        this.exceptionCount =

            (this.summary?.missingInternal || 0) +

            (this.summary?.missingProvider || 0) +

            (this.summary?.mismatches || 0) +

            (this.summary?.duplicates || 0);

        next();
    }
);

/* ============================================================================
 * STATIC METHODS
 * ========================================================================== */

ReconciliationSchema.statics.findBalanced =
    function (
        tenantId
    ) {

        return this.find({

            tenantId,

            isBalanced:
                true,

            deleted:
                false
        });
    };

ReconciliationSchema.statics.findExceptions =
    function (
        tenantId
    ) {

        return this.find({

            tenantId,

            isBalanced:
                false,

            deleted:
                false
        });
    };

/* ============================================================================
 * MODEL EXPORT
 * ========================================================================== */

module.exports =
    mongoose.models.Reconciliation ||

    mongoose.model(

        "Reconciliation",

        ReconciliationSchema
    );