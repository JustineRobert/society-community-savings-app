"use strict";

const mongoose = require("mongoose");
const crypto = require("crypto");

const { Schema } = mongoose;

/**
 * ============================================================================
 * TITech Community Capital LTD
 * LoanAudit.js
 * ============================================================================
 *
 * Enterprise Immutable Loan Audit Model
 *
 * Purpose:
 *   Provides a durable audit trail for the complete loan lifecycle.
 *
 * Tracks:
 *   - Eligibility assessments
 *   - Applications
 *   - Application updates
 *   - Approvals
 *   - Rejections
 *   - Cancellations
 *   - Disbursements
 *   - Repayments
 *   - Defaults
 *   - Write-offs
 *   - Restructuring
 *   - Administrative overrides
 *   - Custom workflow events
 *
 * Enterprise guarantees:
 *   - Multi-tenant isolation
 *   - Immutable audit records
 *   - Idempotent event support
 *   - Audit correlation
 *   - Tamper-evident hashing
 *   - Query-friendly indexes
 *   - Regulatory reporting support
 *   - Operational timeline queries
 *
 * Important:
 *   This model is intentionally NOT responsible for financial posting,
 *   loan state transitions, authorization, or workflow orchestration.
 *
 * ============================================================================
 */

/**
 * ============================================================================
 * Constants
 * ============================================================================
 */

const ACTOR_TYPES = Object.freeze([
    "USER",
    "ADMIN",
    "SYSTEM",
    "API",
    "SERVICE"
]);

const EVENT_TYPES = Object.freeze([
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
]);

const PROVIDERS = Object.freeze([
    "MTN_MOMO",
    "AIRTEL_MONEY",
    "BANK",
    "CASH",
    "MANUAL",
    "OTHER"
]);

/**
 * ============================================================================
 * Schema
 * ============================================================================
 */

const LoanAuditSchema = new Schema(
    {
        /**
         * ---------------------------------------------------------------------
         * Multi-Tenant Isolation
         * ---------------------------------------------------------------------
         */

        tenantId: {
            type: String,
            required: true,
            trim: true,
            immutable: true,
            index: true
        },

        /**
         * ---------------------------------------------------------------------
         * SACCO / Group
         * ---------------------------------------------------------------------
         */

        groupId: {
            type: Schema.Types.ObjectId,
            ref: "Group",
            default: null,
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * Member
         * ---------------------------------------------------------------------
         */

        memberId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
            index: true
        },

        /**
         * ---------------------------------------------------------------------
         * Loan
         * ---------------------------------------------------------------------
         */

        loanId: {
            type: Schema.Types.ObjectId,
            ref: "Loan",
            required: true,
            immutable: true,
            index: true
        },

        /**
         * ---------------------------------------------------------------------
         * Actor
         * ---------------------------------------------------------------------
         */

        actorId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            immutable: true
        },

        actorType: {
            type: String,
            enum: ACTOR_TYPES,
            default: "SYSTEM",
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * Event Type
         * ---------------------------------------------------------------------
         */

        eventType: {
            type: String,
            required: true,
            enum: EVENT_TYPES,
            immutable: true,
            index: true
        },

        /**
         * ---------------------------------------------------------------------
         * Risk Assessment
         * ---------------------------------------------------------------------
         */

        score: {
            type: Number,
            default: null,
            min: 0
        },

        eligible: {
            type: Boolean,
            default: null
        },

        breakdown: {
            type: Schema.Types.Mixed,
            default: null
        },

        /**
         * ---------------------------------------------------------------------
         * Financial Snapshot
         * ---------------------------------------------------------------------
         *
         * Stored as an audit snapshot rather than the authoritative financial
         * record.
         */

        amount: {
            type: Number,
            default: null,
            min: 0,
            validate: {
                validator(value) {
                    return value === null || Number.isFinite(value);
                },
                message: "Audit amount must be a finite number"
            }
        },

        currency: {
            type: String,
            default: "UGX",
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
            match: /^[A-Z]{3}$/
        },

        interestRate: {
            type: Number,
            default: null,
            min: 0
        },

        /**
         * ---------------------------------------------------------------------
         * External / Financial Transaction Reference
         * ---------------------------------------------------------------------
         */

        transactionId: {
            type: String,
            trim: true,
            default: null,
            immutable: true,
            index: true
        },

        provider: {
            type: String,
            enum: PROVIDERS,
            default: "OTHER",
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * State Transition Snapshot
         * ---------------------------------------------------------------------
         */

        previousStatus: {
            type: String,
            trim: true,
            default: null
        },

        currentStatus: {
            type: String,
            trim: true,
            default: null
        },

        /**
         * ---------------------------------------------------------------------
         * Human-Readable Reasoning
         * ---------------------------------------------------------------------
         */

        reason: {
            type: String,
            maxlength: 5000,
            trim: true,
            default: null
        },

        remarks: {
            type: String,
            maxlength: 5000,
            trim: true,
            default: null
        },

        /**
         * ---------------------------------------------------------------------
         * Request / Security Context
         * ---------------------------------------------------------------------
         */

        ipAddress: {
            type: String,
            maxlength: 128,
            trim: true,
            default: null,
            immutable: true
        },

        userAgent: {
            type: String,
            maxlength: 2048,
            trim: true,
            default: null,
            immutable: true
        },

        correlationId: {
            type: String,
            maxlength: 256,
            trim: true,
            default: null,
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * Idempotency
         * ---------------------------------------------------------------------
         */

        idempotencyKey: {
            type: String,
            trim: true,
            maxlength: 256,
            default: null,
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * Arbitrary Audit Metadata
         * ---------------------------------------------------------------------
         */

        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        },

        /**
         * ---------------------------------------------------------------------
         * Tamper-Evident Integrity
         * ---------------------------------------------------------------------
         *
         * immutableHash is calculated from the immutable audit payload.
         *
         * This does NOT replace database-level security or append-only storage.
         * It provides an additional integrity signal for detecting unexpected
         * modifications.
         */

        immutableHash: {
            type: String,
            trim: true,
            maxlength: 128,
            default: null,
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * Archive Flag
         * ---------------------------------------------------------------------
         *
         * Audit records are never deleted. Archiving is a visibility/query
         * concern rather than deletion.
         */

        isArchived: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    {
        timestamps: true,

        /**
         * Audit records do not require Mongoose's __v version field.
         */
        versionKey: false,

        collection: "loan_audits",

        /**
         * Preserve empty metadata objects.
         */
        minimize: false,

        strict: true
    }
);

/**
 * ============================================================================
 * Compound Indexes
 * ============================================================================
 */

/**
 * Tenant loan timeline.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        loanId: 1,
        createdAt: -1
    },
    {
        name: "idx_loan_audit_tenant_loan_timeline"
    }
);

/**
 * Tenant member history.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        memberId: 1,
        createdAt: -1
    },
    {
        name: "idx_loan_audit_tenant_member_timeline"
    }
);

/**
 * Tenant event analytics.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        eventType: 1,
        createdAt: -1
    },
    {
        name: "idx_loan_audit_tenant_event_timeline"
    }
);

/**
 * Tenant transaction audit lookup.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        transactionId: 1
    },
    {
        name: "idx_loan_audit_tenant_transaction"
    }
);

/**
 * Tenant-wide chronological reporting.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        createdAt: -1
    },
    {
        name: "idx_loan_audit_tenant_created"
    }
);

/**
 * Provider transaction lookup.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        provider: 1,
        transactionId: 1
    },
    {
        name: "idx_loan_audit_provider_transaction"
    }
);

/**
 * Correlation tracing.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        correlationId: 1,
        createdAt: -1
    },
    {
        name: "idx_loan_audit_correlation"
    }
);

/**
 * Idempotency lookup.
 *
 * Partial index prevents null idempotency values from creating unnecessary
 * index entries and allows repeated null values.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        idempotencyKey: 1
    },
    {
        name: "idx_loan_audit_idempotency",
        unique: true,
        partialFilterExpression: {
            idempotencyKey: {
                $type: "string"
            }
        }
    }
);

/**
 * ============================================================================
 * Integrity Helpers
 * ============================================================================
 */

/**
 * Build a canonical audit payload for hashing.
 *
 * Only stable business/audit fields are included.
 *
 * @param {Object} doc
 * @returns {string}
 */
function buildIntegrityPayload(doc) {
    return JSON.stringify({
        tenantId: doc.tenantId || null,
        groupId: doc.groupId
            ? String(doc.groupId)
            : null,
        memberId: doc.memberId
            ? String(doc.memberId)
            : null,
        loanId: doc.loanId
            ? String(doc.loanId)
            : null,
        actorId: doc.actorId
            ? String(doc.actorId)
            : null,
        actorType: doc.actorType || null,
        eventType: doc.eventType || null,
        score: doc.score ?? null,
        eligible: doc.eligible ?? null,
        breakdown: doc.breakdown ?? null,
        amount: doc.amount ?? null,
        currency: doc.currency || null,
        interestRate: doc.interestRate ?? null,
        transactionId: doc.transactionId || null,
        provider: doc.provider || null,
        previousStatus: doc.previousStatus || null,
        currentStatus: doc.currentStatus || null,
        reason: doc.reason || null,
        remarks: doc.remarks || null,
        correlationId: doc.correlationId || null,
        idempotencyKey: doc.idempotencyKey || null,
        metadata: doc.metadata || {},
        createdAt: doc.createdAt
            ? new Date(doc.createdAt).toISOString()
            : null
    });
}

/**
 * Generate integrity hash.
 *
 * @param {Object} doc
 * @returns {string}
 */
function generateIntegrityHash(doc) {
    return crypto
        .createHash("sha256")
        .update(buildIntegrityPayload(doc))
        .digest("hex");
}

/**
 * ============================================================================
 * Pre-Save Integrity Hash
 * ============================================================================
 */

LoanAuditSchema.pre("save", function(next) {
    try {
        /**
         * Only generate the hash when creating a new record.
         *
         * Audit records are append-only.
         */
        if (this.isNew && !this.immutableHash) {
            this.immutableHash = generateIntegrityHash(this);
        }

        next();
    } catch (error) {
        next(error);
    }
});

/**
 * ============================================================================
 * Immutability Enforcement
 * ============================================================================
 *
 * Block all common mutation and deletion operations.
 */

const IMMUTABLE_ERROR =
    "Loan audit records are immutable and cannot be modified or deleted";

/**
 * Query-level mutation protection.
 */

[
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "findByIdAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "findOneAndDelete",
    "findByIdAndDelete",
    "deleteOne",
    "deleteMany"
].forEach(method => {
    LoanAuditSchema.pre(method, function(next) {
        next(new Error(IMMUTABLE_ERROR));
    });
});

/**
 * Document-level deletion protection.
 */

LoanAuditSchema.pre(
    "deleteOne",
    { document: true, query: false },
    function(next) {
        next(new Error(IMMUTABLE_ERROR));
    }
);

/**
 * Prevent save() from modifying an existing audit record.
 *
 * New records may be inserted normally.
 */
LoanAuditSchema.pre("save", function(next) {
    if (!this.isNew && this.isModified()) {
        return next(new Error(IMMUTABLE_ERROR));
    }

    next();
});

/**
 * ============================================================================
 * Static: Verify Integrity
 * ============================================================================
 *
 * @param {Object} auditDocument
 * @returns {boolean}
 */
LoanAuditSchema.statics.verifyIntegrity = function(auditDocument) {
    if (!auditDocument) {
        return false;
    }

    if (!auditDocument.immutableHash) {
        return false;
    }

    const expectedHash =
        generateIntegrityHash(auditDocument);

    return crypto.timingSafeEqual(
        Buffer.from(expectedHash, "utf8"),
        Buffer.from(auditDocument.immutableHash, "utf8")
    );
};

/**
 * ============================================================================
 * Static: Get Loan Timeline
 * ============================================================================
 *
 * Tenant-aware timeline lookup.
 *
 * @param {string} loanId
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.getLoanTimeline = function(
    loanId,
    tenantId
) {
    if (!loanId) {
        throw new Error("loanId is required");
    }

    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.find({
        tenantId,
        loanId,
        isArchived: false
    })
        .sort({
            createdAt: 1
        })
        .lean();
};

/**
 * ============================================================================
 * Static: Get Member History
 * ============================================================================
 *
 * @param {string} memberId
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.getMemberHistory = function(
    memberId,
    tenantId
) {
    if (!memberId) {
        throw new Error("memberId is required");
    }

    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.find({
        tenantId,
        memberId,
        isArchived: false
    })
        .sort({
            createdAt: -1
        })
        .lean();
};

/**
 * ============================================================================
 * Static: Get Event Summary
 * ============================================================================
 *
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.getEventSummary = function(
    tenantId
) {
    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.aggregate([
        {
            $match: {
                tenantId,
                isArchived: false
            }
        },
        {
            $group: {
                _id: "$eventType",
                total: {
                    $sum: 1
                }
            }
        },
        {
            $sort: {
                total: -1
            }
        }
    ]);
};

/**
 * ============================================================================
 * Static: Find By Transaction
 * ============================================================================
 *
 * @param {string} transactionId
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.findByTransaction = function(
    transactionId,
    tenantId
) {
    if (!transactionId) {
        throw new Error("transactionId is required");
    }

    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.find({
        tenantId,
        transactionId,
        isArchived: false
    })
        .sort({
            createdAt: -1
        })
        .lean();
};

/**
 * ============================================================================
 * Static: Find By Correlation
 * ============================================================================
 *
 * Useful for tracing:
 *
 * HTTP request
 *     ↓
 * payment
 *     ↓
 * loan
 *     ↓
 * ledger
 *     ↓
 * audit
 *
 * @param {string} correlationId
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.findByCorrelation = function(
    correlationId,
    tenantId
) {
    if (!correlationId) {
        throw new Error("correlationId is required");
    }

    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.find({
        tenantId,
        correlationId,
        isArchived: false
    })
        .sort({
            createdAt: 1
        })
        .lean();
};

/**
 * ============================================================================
 * Static: Find Idempotency Event
 * ============================================================================
 *
 * @param {string} idempotencyKey
 * @param {string} tenantId
 * @returns {Promise<Object|null>}
 */
LoanAuditSchema.statics.findByIdempotencyKey = function(
    idempotencyKey,
    tenantId
) {
    if (!idempotencyKey) {
        throw new Error("idempotencyKey is required");
    }

    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.findOne({
        tenantId,
        idempotencyKey
    }).lean();
};

/**
 * ============================================================================
 * Static: Create Audit Event
 * ============================================================================
 *
 * Centralized creation helper.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
LoanAuditSchema.statics.recordEvent = async function(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Audit event payload is required");
    }

    const {
        tenantId,
        loanId,
        memberId,
        eventType
    } = payload;

    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    if (!loanId) {
        throw new Error("loanId is required");
    }

    if (!memberId) {
        throw new Error("memberId is required");
    }

    if (!eventType) {
        throw new Error("eventType is required");
    }

    /**
     * Idempotent event protection.
     */
    if (payload.idempotencyKey) {
        const existing =
            await this.findOne({
                tenantId,
                idempotencyKey:
                    payload.idempotencyKey
            });

        if (existing) {
            return existing;
        }
    }

    return this.create(payload);
};

/**
 * ============================================================================
 * Static: Count Tenant Events
 * ============================================================================
 *
 * @param {string} tenantId
 * @param {Object} filter
 * @returns {Promise<number>}
 */
LoanAuditSchema.statics.countTenantEvents = function(
    tenantId,
    filter = {}
) {
    if (!tenantId) {
        throw new Error("tenantId is required");
    }

    return this.countDocuments({
        tenantId,
        isArchived: false,
        ...filter
    });
};

/**
 * ============================================================================
 * Static: Archive Protection
 * ============================================================================
 *
 * Archiving is intentionally disabled here because audit records themselves
 * must remain immutable. If operational retention requires archive state,
 * it should be handled by an append-only archival workflow or separate
 * archival store rather than mutating the original record.
 * ============================================================================
 */

/**
 * ============================================================================
 * JSON Serialization
 * ============================================================================
 */

LoanAuditSchema.set(
    "toJSON",
    {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.__v;

            return ret;
        }
    }
);

/**
 * ============================================================================
 * Export
 * ============================================================================
 */

const LoanAudit =
    mongoose.models.LoanAudit ||
    mongoose.model(
        "LoanAudit",
        LoanAuditSchema
    );

module.exports = LoanAudit;

/**
 * Export constants for services/tests that need the domain vocabulary.
 */
module.exports.ACTOR_TYPES = ACTOR_TYPES;
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.PROVIDERS = PROVIDERS;