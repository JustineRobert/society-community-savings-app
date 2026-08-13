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
 * File:
 *   backend/modules/loans/models/LoanAudit.js
 *
 * Purpose
 * ----------------------------------------------------------------------------
 * Durable, append-only, tenant-isolated audit evidence for the complete
 * lifecycle of a loan.
 *
 * Tracks
 * ----------------------------------------------------------------------------
 * - Eligibility assessments
 * - Applications
 * - Application updates
 * - Approvals
 * - Rejections
 * - Cancellations
 * - Disbursements
 * - Repayments
 * - Defaults
 * - Write-offs
 * - Restructuring
 * - Administrative overrides
 * - Custom workflow events
 *
 * Enterprise Guarantees
 * ----------------------------------------------------------------------------
 * - Multi-tenant isolation
 * - Append-only persistence semantics
 * - Document immutability
 * - Query mutation protection
 * - Delete protection
 * - Idempotent event recording
 * - Duplicate-key race recovery
 * - Correlation tracing
 * - Deterministic canonical hashing
 * - Tamper-evident integrity verification
 * - Optional per-loan hash-chain support
 * - ObjectId validation
 * - Query-safe pagination
 * - Query-friendly compound indexes
 * - Regulatory reporting support
 *
 * Important
 * ----------------------------------------------------------------------------
 * This model is intentionally NOT responsible for:
 *
 * - Loan authorization
 * - Loan workflow transitions
 * - Financial posting
 * - Ledger mutation
 * - Payment execution
 * - External side-effect orchestration
 *
 * The audit model records evidence. It does not execute business operations.
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

const DEFAULT_CURRENCY = "UGX";

const MAX_PAGE_SIZE = 500;

const DEFAULT_PAGE_SIZE = 100;

const MAX_METADATA_BYTES = 256 * 1024;

const IMMUTABLE_ERROR =
    "Loan audit records are immutable and cannot be modified or deleted";

const INVALID_OBJECT_ID_ERROR =
    "Invalid MongoDB ObjectId";

const ALLOWED_COUNT_FILTER_FIELDS = Object.freeze([
    "loanId",
    "memberId",
    "groupId",
    "actorId",
    "actorType",
    "eventType",
    "transactionId",
    "provider",
    "correlationId",
    "idempotencyKey",
    "previousStatus",
    "currentStatus",
    "createdAt"
]);

/**
 * ============================================================================
 * Utility Helpers
 * ============================================================================
 */

/**
 * Ensure a required non-empty string.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireNonEmptyString(value, fieldName) {
    if (
        typeof value !== "string" ||
        !value.trim()
    ) {
        throw new Error(`${fieldName} is required`);
    }

    return value.trim();
}

/**
 * Normalize an ObjectId-compatible value.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {mongoose.Types.ObjectId}
 */
function requireObjectId(value, fieldName) {
    if (!mongoose.isValidObjectId(value)) {
        throw new Error(
            `${fieldName}: ${INVALID_OBJECT_ID_ERROR}`
        );
    }

    return new mongoose.Types.ObjectId(value);
}

/**
 * Normalize an optional ObjectId-compatible value.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {mongoose.Types.ObjectId|null}
 */
function normalizeOptionalObjectId(
    value,
    fieldName
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    return requireObjectId(
        value,
        fieldName
    );
}

/**
 * Ensure a plain object.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {Object}
 */
function requirePlainObject(
    value,
    fieldName
) {
    if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new Error(
            `${fieldName} must be an object`
        );
    }

    return value;
}

/**
 * Convert arbitrary values into deterministic canonical structures.
 *
 * Object keys are sorted recursively so logically identical metadata
 * produces the same integrity hash regardless of insertion order.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function canonicalize(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return value ?? null;
    }

    if (
        typeof value === "string" ||
        typeof value === "boolean"
    ) {
        return value;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(
                "Audit integrity payload contains a non-finite number"
            );
        }

        return value;
    }

    if (typeof value === "bigint") {
        return {
            __type: "bigint",
            value: value.toString()
        };
    }

    if (value instanceof Date) {
        if (
            Number.isNaN(
                value.getTime()
            )
        ) {
            throw new Error(
                "Audit integrity payload contains an invalid date"
            );
        }

        return {
            __type: "date",
            value: value.toISOString()
        };
    }

    if (
        value instanceof mongoose.Types.ObjectId
    ) {
        return {
            __type: "objectId",
            value: value.toString()
        };
    }

    if (Buffer.isBuffer(value)) {
        return {
            __type: "buffer",
            value: value.toString("base64")
        };
    }

    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }

    if (typeof value === "object") {
        const normalized = {};

        Object.keys(value)
            .sort()
            .forEach((key) => {
                normalized[key] =
                    canonicalize(value[key]);
            });

        return normalized;
    }

    return String(value);
}

/**
 * Safely serialize an object using deterministic key ordering.
 *
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
    return JSON.stringify(
        canonicalize(value)
    );
}

/**
 * Calculate approximate serialized object size.
 *
 * @param {unknown} value
 * @returns {number}
 */
function serializedByteLength(value) {
    return Buffer.byteLength(
        stableStringify(value),
        "utf8"
    );
}

/**
 * Validate metadata size before persistence.
 *
 * @param {unknown} metadata
 */
function validateMetadata(metadata) {
    if (
        metadata === null ||
        metadata === undefined
    ) {
        return;
    }

    requirePlainObject(
        metadata,
        "metadata"
    );

    const size =
        serializedByteLength(metadata);

    if (
        size > MAX_METADATA_BYTES
    ) {
        throw new Error(
            `metadata exceeds the maximum allowed size of ${MAX_METADATA_BYTES} bytes`
        );
    }
}

/**
 * Normalize pagination options.
 *
 * @param {Object} [options={}]
 * @returns {{limit:number,skip:number}}
 */
function normalizePagination(
    options = {}
) {
    const requestedLimit =
        Number(
            options.limit ??
            DEFAULT_PAGE_SIZE
        );

    const requestedSkip =
        Number(
            options.skip ?? 0
        );

    const limit = Number.isFinite(
        requestedLimit
    )
        ? Math.max(
            1,
            Math.min(
                Math.floor(requestedLimit),
                MAX_PAGE_SIZE
            )
        )
        : DEFAULT_PAGE_SIZE;

    const skip = Number.isFinite(
        requestedSkip
    )
        ? Math.max(
            0,
            Math.floor(requestedSkip)
        )
        : 0;

    return {
        limit,
        skip
    };
}

/**
 * Extract only explicitly supported count filters.
 *
 * Prevents callers from injecting arbitrary MongoDB operators into
 * tenant-scoped count queries.
 *
 * @param {Object} filter
 * @returns {Object}
 */
function sanitizeCountFilter(
    filter = {}
) {
    if (
        !filter ||
        typeof filter !== "object" ||
        Array.isArray(filter)
    ) {
        return {};
    }

    const sanitized = {};

    for (
        const field of
        ALLOWED_COUNT_FILTER_FIELDS
    ) {
        if (
            Object.prototype.hasOwnProperty.call(
                filter,
                field
            )
        ) {
            sanitized[field] =
                filter[field];
        }
    }

    return sanitized;
}

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
            index: true,
            maxlength: 256
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
         * Risk Assessment Snapshot
         * ---------------------------------------------------------------------
         */

        score: {
            type: Number,
            default: null,
            min: 0,
            immutable: true,
            validate: {
                validator(value) {
                    return (
                        value === null ||
                        value === undefined ||
                        Number.isFinite(value)
                    );
                },
                message:
                    "Audit score must be a finite number"
            }
        },

        eligible: {
            type: Boolean,
            default: null,
            immutable: true
        },

        breakdown: {
            type: Schema.Types.Mixed,
            default: null,
            immutable: true
        },

        /**
         * ---------------------------------------------------------------------
         * Financial Snapshot
         * ---------------------------------------------------------------------
         */

        amount: {
            type: Number,
            default: null,
            min: 0,
            immutable: true,
            validate: {
                validator(value) {
                    return (
                        value === null ||
                        value === undefined ||
                        Number.isFinite(value)
                    );
                },
                message:
                    "Audit amount must be a finite number"
            }
        },

        currency: {
            type: String,
            default: DEFAULT_CURRENCY,
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
            match: /^[A-Z]{3}$/,
            immutable: true
        },

        interestRate: {
            type: Number,
            default: null,
            min: 0,
            immutable: true,
            validate: {
                validator(value) {
                    return (
                        value === null ||
                        value === undefined ||
                        Number.isFinite(value)
                    );
                },
                message:
                    "Audit interestRate must be a finite number"
            }
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
            maxlength: 512,
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
            default: null,
            immutable: true,
            maxlength: 256
        },

        currentStatus: {
            type: String,
            trim: true,
            default: null,
            immutable: true,
            maxlength: 256
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
            default: null,
            immutable: true
        },

        remarks: {
            type: String,
            maxlength: 5000,
            trim: true,
            default: null,
            immutable: true
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
            immutable: true,
            index: true
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
            default: {},
            immutable: true,
            validate: {
                validator(value) {
                    try {
                        validateMetadata(
                            value
                        );

                        return true;
                    } catch (error) {
                        return false;
                    }
                },
                message:
                    "Audit metadata is invalid or exceeds the maximum allowed size"
            }
        },

        /**
         * ---------------------------------------------------------------------
         * Hash Chain
         * ---------------------------------------------------------------------
         *
         * sequence is allocated monotonically per tenant + loan.
         *
         * previousHash references the immediately preceding audit event for the
         * same loan where available.
         *
         * This strengthens tamper evidence but does not replace:
         *
         * - database access controls
         * - backups
         * - WORM storage
         * - external audit replication
         */

        sequence: {
            type: Number,
            required: true,
            immutable: true,
            min: 1
        },

        previousHash: {
            type: String,
            default: null,
            immutable: true,
            minlength: 64,
            maxlength: 64,
            match: /^[a-f0-9]{64}$/
        },

        /**
         * ---------------------------------------------------------------------
         * Tamper-Evident Integrity
         * ---------------------------------------------------------------------
         */

        immutableHash: {
            type: String,
            trim: true,
            required: true,
            immutable: true,
            minlength: 64,
            maxlength: 64,
            match: /^[a-f0-9]{64}$/
        },

        /**
         * ---------------------------------------------------------------------
         * Event Time
         * ---------------------------------------------------------------------
         *
         * eventOccurredAt represents when the business event occurred.
         *
         * createdAt represents when the audit evidence was persisted.
         */

        eventOccurredAt: {
            type: Date,
            default: Date.now,
            immutable: true,
            index: true
        }
    },
    {
        timestamps: true,

        versionKey: false,

        collection: "loan_audits",

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
 * Tenant + loan timeline.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        loanId: 1,
        sequence: 1
    },
    {
        unique: true,
        name:
            "uq_loan_audit_tenant_loan_sequence"
    }
);

/**
 * Operational chronological timeline.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        loanId: 1,
        createdAt: -1
    },
    {
        name:
            "idx_loan_audit_tenant_loan_timeline"
    }
);

/**
 * Business event timeline.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        loanId: 1,
        eventOccurredAt: -1
    },
    {
        name:
            "idx_loan_audit_tenant_loan_event_time"
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
        name:
            "idx_loan_audit_tenant_member_timeline"
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
        name:
            "idx_loan_audit_tenant_event_timeline"
    }
);

/**
 * Regulatory reporting.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        currentStatus: 1,
        eventOccurredAt: -1
    },
    {
        name:
            "idx_loan_audit_tenant_status_event"
    }
);

/**
 * Transaction audit lookup.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        transactionId: 1,
        createdAt: -1
    },
    {
        name:
            "idx_loan_audit_tenant_transaction"
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
        name:
            "idx_loan_audit_provider_transaction"
    }
);

/**
 * Correlation tracing.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        correlationId: 1,
        createdAt: 1
    },
    {
        name:
            "idx_loan_audit_correlation"
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
        name:
            "idx_loan_audit_tenant_created"
    }
);

/**
 * Idempotency protection.
 *
 * Null values are excluded so multiple audit events may legitimately omit an
 * idempotency key.
 */
LoanAuditSchema.index(
    {
        tenantId: 1,
        idempotencyKey: 1
    },
    {
        name:
            "uq_loan_audit_idempotency",
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
 * Build the canonical immutable payload.
 *
 * @param {Object} doc
 * @returns {Object}
 */
function buildIntegrityPayload(doc) {
    return {
        tenantId:
            doc.tenantId || null,

        groupId:
            doc.groupId
                ? String(doc.groupId)
                : null,

        memberId:
            doc.memberId
                ? String(doc.memberId)
                : null,

        loanId:
            doc.loanId
                ? String(doc.loanId)
                : null,

        actorId:
            doc.actorId
                ? String(doc.actorId)
                : null,

        actorType:
            doc.actorType || null,

        eventType:
            doc.eventType || null,

        score:
            doc.score ?? null,

        eligible:
            doc.eligible ?? null,

        breakdown:
            doc.breakdown ?? null,

        amount:
            doc.amount ?? null,

        currency:
            doc.currency || null,

        interestRate:
            doc.interestRate ?? null,

        transactionId:
            doc.transactionId || null,

        provider:
            doc.provider || null,

        previousStatus:
            doc.previousStatus || null,

        currentStatus:
            doc.currentStatus || null,

        reason:
            doc.reason || null,

        remarks:
            doc.remarks || null,

        ipAddress:
            doc.ipAddress || null,

        userAgent:
            doc.userAgent || null,

        correlationId:
            doc.correlationId || null,

        idempotencyKey:
            doc.idempotencyKey || null,

        metadata:
            doc.metadata || {},

        sequence:
            doc.sequence ?? null,

        previousHash:
            doc.previousHash || null,

        eventOccurredAt:
            doc.eventOccurredAt
                ? new Date(
                    doc.eventOccurredAt
                ).toISOString()
                : null,

        createdAt:
            doc.createdAt
                ? new Date(
                    doc.createdAt
                ).toISOString()
                : null
    };
}

/**
 * Generate deterministic SHA-256 integrity hash.
 *
 * @param {Object} doc
 * @returns {string}
 */
function generateIntegrityHash(doc) {
    return crypto
        .createHash("sha256")
        .update(
            stableStringify(
                buildIntegrityPayload(doc)
            ),
            "utf8"
        )
        .digest("hex");
}

/**
 * ============================================================================
 * Creation Validation
 * ============================================================================
 */

LoanAuditSchema.pre(
    "validate",
    function(next) {
        try {
            if (!this.isNew) {
                return next();
            }

            requireNonEmptyString(
                this.tenantId,
                "tenantId"
            );

            requireObjectId(
                this.loanId,
                "loanId"
            );

            requireObjectId(
                this.memberId,
                "memberId"
            );

            normalizeOptionalObjectId(
                this.groupId,
                "groupId"
            );

            normalizeOptionalObjectId(
                this.actorId,
                "actorId"
            );

            if (
                !EVENT_TYPES.includes(
                    this.eventType
                )
            ) {
                throw new Error(
                    "eventType is invalid"
                );
            }

            if (
                !ACTOR_TYPES.includes(
                    this.actorType
                )
            ) {
                throw new Error(
                    "actorType is invalid"
                );
            }

            if (
                !PROVIDERS.includes(
                    this.provider
                )
            ) {
                throw new Error(
                    "provider is invalid"
                );
            }

            validateMetadata(
                this.metadata
            );

            if (
                this.breakdown !== null &&
                this.breakdown !== undefined &&
                typeof this.breakdown !==
                    "object"
            ) {
                throw new Error(
                    "breakdown must be an object when provided"
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ============================================================================
 * Sequence / Hash Chain Allocation
 * ============================================================================
 *
 * This allocation is performed immediately before saving a new document.
 *
 * The unique (tenantId, loanId, sequence) index is the final concurrency
 * authority. recordEvent() retries duplicate sequence collisions.
 */

LoanAuditSchema.pre(
    "save",
    async function(next) {
        try {
            if (!this.isNew) {
                return next();
            }

            if (
                !this.sequence ||
                this.sequence < 1
            ) {
                const previous =
                    await this.constructor
                        .findOne({
                            tenantId:
                                this.tenantId,
                            loanId:
                                this.loanId
                        })
                        .sort({
                            sequence: -1
                        })
                        .select({
                            sequence: 1,
                            immutableHash: 1
                        })
                        .lean();

                this.sequence =
                    previous
                        ? previous.sequence + 1
                        : 1;

                this.previousHash =
                    previous
                        ? previous.immutableHash
                        : null;
            }

            next();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ============================================================================
 * Pre-Save Integrity Hash
 * ============================================================================
 */

LoanAuditSchema.pre(
    "save",
    function(next) {
        try {
            if (
                this.isNew &&
                !this.immutableHash
            ) {
                /**
                 * Mongoose timestamps have already populated createdAt by this
                 * point in the save lifecycle.
                 */
                this.immutableHash =
                    generateIntegrityHash(
                        this
                    );
            }

            next();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ============================================================================
 * Immutability Enforcement
 * ============================================================================
 */

/**
 * Prevent existing documents from being re-saved.
 */
LoanAuditSchema.pre(
    "save",
    function(next) {
        if (
            !this.isNew &&
            this.isModified()
        ) {
            return next(
                new Error(
                    IMMUTABLE_ERROR
                )
            );
        }

        return next();
    }
);

/**
 * Query-level mutation and deletion protection.
 */
[
    "update",
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
].forEach((method) => {
    LoanAuditSchema.pre(
        method,
        function(next) {
            next(
                new Error(
                    IMMUTABLE_ERROR
                )
            );
        }
    );
});

/**
 * Document-level delete protection.
 */
LoanAuditSchema.pre(
    "deleteOne",
    {
        document: true,
        query: false
    },
    function(next) {
        next(
            new Error(
                IMMUTABLE_ERROR
            )
        );
    }
);

/**
 * ============================================================================
 * Static: Verify Integrity
 * ============================================================================
 *
 * @param {Object} auditDocument
 * @returns {boolean}
 */
LoanAuditSchema.statics.verifyIntegrity =
function verifyIntegrity(
    auditDocument
) {
    if (
        !auditDocument ||
        !auditDocument.immutableHash
    ) {
        return false;
    }

    try {
        const expectedHash =
            generateIntegrityHash(
                auditDocument
            );

        const actualHash =
            String(
                auditDocument.immutableHash
            );

        const expectedBuffer =
            Buffer.from(
                expectedHash,
                "utf8"
            );

        const actualBuffer =
            Buffer.from(
                actualHash,
                "utf8"
            );

        if (
            expectedBuffer.length !==
            actualBuffer.length
        ) {
            return false;
        }

        return crypto.timingSafeEqual(
            expectedBuffer,
            actualBuffer
        );
    } catch (error) {
        return false;
    }
};

/**
 * ============================================================================
 * Static: Verify Loan Hash Chain
 * ============================================================================
 *
 * @param {string|ObjectId} loanId
 * @param {string} tenantId
 * @returns {Promise<{
 *   valid: boolean,
 *   checked: number,
 *   failure: Object|null
 * }>}
 */
LoanAuditSchema.statics.verifyLoanHashChain =
async function verifyLoanHashChain(
    loanId,
    tenantId
) {
    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    const normalizedLoanId =
        requireObjectId(
            loanId,
            "loanId"
        );

    const events =
        await this.find({
            tenantId:
                normalizedTenantId,
            loanId:
                normalizedLoanId
        })
            .sort({
                sequence: 1
            })
            .lean();

    let previousHash = null;

    for (
        let index = 0;
        index < events.length;
        index++
    ) {
        const event =
            events[index];

        const expectedSequence =
            index + 1;

        if (
            event.sequence !==
            expectedSequence
        ) {
            return {
                valid: false,
                checked: index,
                failure: {
                    reason:
                        "SEQUENCE_MISMATCH",
                    expected:
                        expectedSequence,
                    actual:
                        event.sequence,
                    auditId:
                        String(event._id)
                }
            };
        }

        if (
            event.previousHash !==
            previousHash
        ) {
            return {
                valid: false,
                checked: index,
                failure: {
                    reason:
                        "PREVIOUS_HASH_MISMATCH",
                    expected:
                        previousHash,
                    actual:
                        event.previousHash,
                    auditId:
                        String(event._id)
                }
            };
        }

        if (
            !this.verifyIntegrity(
                event
            )
        ) {
            return {
                valid: false,
                checked: index,
                failure: {
                    reason:
                        "INTEGRITY_HASH_MISMATCH",
                    auditId:
                        String(event._id)
                }
            };
        }

        previousHash =
            event.immutableHash;
    }

    return {
        valid: true,
        checked: events.length,
        failure: null
    };
};

/**
 * ============================================================================
 * Static: Get Loan Timeline
 * ============================================================================
 *
 * @param {string|ObjectId} loanId
 * @param {string} tenantId
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.getLoanTimeline =
function getLoanTimeline(
    loanId,
    tenantId,
    options = {}
) {
    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    const normalizedLoanId =
        requireObjectId(
            loanId,
            "loanId"
        );

    const {
        limit,
        skip
    } = normalizePagination(
        options
    );

    return this.find({
        tenantId:
            normalizedTenantId,
        loanId:
            normalizedLoanId
    })
        .sort({
            sequence: 1
        })
        .skip(skip)
        .limit(limit)
        .lean();
};

/**
 * ============================================================================
 * Static: Get Member History
 * ============================================================================
 *
 * @param {string|ObjectId} memberId
 * @param {string} tenantId
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.getMemberHistory =
function getMemberHistory(
    memberId,
    tenantId,
    options = {}
) {
    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    const normalizedMemberId =
        requireObjectId(
            memberId,
            "memberId"
        );

    const {
        limit,
        skip
    } = normalizePagination(
        options
    );

    return this.find({
        tenantId:
            normalizedTenantId,
        memberId:
            normalizedMemberId
    })
        .sort({
            createdAt: -1
        })
        .skip(skip)
        .limit(limit)
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
LoanAuditSchema.statics.getEventSummary =
function getEventSummary(
    tenantId
) {
    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    return this.aggregate([
        {
            $match: {
                tenantId:
                    normalizedTenantId
            }
        },
        {
            $group: {
                _id:
                    "$eventType",
                total: {
                    $sum: 1
                }
            }
        },
        {
            $sort: {
                total: -1,
                _id: 1
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
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.findByTransaction =
function findByTransaction(
    transactionId,
    tenantId,
    options = {}
) {
    const normalizedTransactionId =
        requireNonEmptyString(
            transactionId,
            "transactionId"
        );

    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    const {
        limit,
        skip
    } = normalizePagination(
        options
    );

    return this.find({
        tenantId:
            normalizedTenantId,
        transactionId:
            normalizedTransactionId
    })
        .sort({
            createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .lean();
};

/**
 * ============================================================================
 * Static: Find By Correlation
 * ============================================================================
 *
 * @param {string} correlationId
 * @param {string} tenantId
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
LoanAuditSchema.statics.findByCorrelation =
function findByCorrelation(
    correlationId,
    tenantId,
    options = {}
) {
    const normalizedCorrelationId =
        requireNonEmptyString(
            correlationId,
            "correlationId"
        );

    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    const {
        limit,
        skip
    } = normalizePagination(
        options
    );

    return this.find({
        tenantId:
            normalizedTenantId,
        correlationId:
            normalizedCorrelationId
    })
        .sort({
            sequence: 1
        })
        .skip(skip)
        .limit(limit)
        .lean();
};

/**
 * ============================================================================
 * Static: Find By Idempotency Key
 * ============================================================================
 *
 * @param {string} idempotencyKey
 * @param {string} tenantId
 * @returns {Promise<Object|null>}
 */
LoanAuditSchema.statics.findByIdempotencyKey =
function findByIdempotencyKey(
    idempotencyKey,
    tenantId
) {
    const normalizedIdempotencyKey =
        requireNonEmptyString(
            idempotencyKey,
            "idempotencyKey"
        );

    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    return this.findOne({
        tenantId:
            normalizedTenantId,
        idempotencyKey:
            normalizedIdempotencyKey
    }).lean();
};

/**
 * ============================================================================
 * Static: Create Audit Event
 * ============================================================================
 *
 * Idempotent and concurrency-aware event creation.
 *
 * The idempotency unique index remains the final authority.
 *
 * Sequence collisions can occur when multiple audit events for the same loan
 * are inserted concurrently. These are retried and the sequence/hash chain is
 * recalculated on the next attempt.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
LoanAuditSchema.statics.recordEvent =
async function recordEvent(
    payload
) {
    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {
        throw new Error(
            "Audit event payload is required"
        );
    }

    const normalizedPayload = {
        ...payload
    };

    normalizedPayload.tenantId =
        requireNonEmptyString(
            normalizedPayload.tenantId,
            "tenantId"
        );

    normalizedPayload.loanId =
        requireObjectId(
            normalizedPayload.loanId,
            "loanId"
        );

    normalizedPayload.memberId =
        requireObjectId(
            normalizedPayload.memberId,
            "memberId"
        );

    if (
        normalizedPayload.groupId !==
        undefined
    ) {
        normalizedPayload.groupId =
            normalizeOptionalObjectId(
                normalizedPayload.groupId,
                "groupId"
            );
    }

    if (
        normalizedPayload.actorId !==
        undefined
    ) {
        normalizedPayload.actorId =
            normalizeOptionalObjectId(
                normalizedPayload.actorId,
                "actorId"
            );
    }

    if (
        !EVENT_TYPES.includes(
            normalizedPayload.eventType
        )
    ) {
        throw new Error(
            "eventType is required and must be valid"
        );
    }

    validateMetadata(
        normalizedPayload.metadata ??
        {}
    );

    if (
        normalizedPayload.idempotencyKey
    ) {
        normalizedPayload.idempotencyKey =
            requireNonEmptyString(
                normalizedPayload.idempotencyKey,
                "idempotencyKey"
            );

        const existing =
            await this.findOne({
                tenantId:
                    normalizedPayload.tenantId,
                idempotencyKey:
                    normalizedPayload.idempotencyKey
            });

        if (existing) {
            return existing;
        }
    }

    /**
     * Sequence conflicts are retried because concurrent writers may observe
     * the same latest sequence.
     */
    const maxAttempts = 5;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {
        try {
            /**
             * Explicit sequence/hash values supplied by callers are ignored.
             * The model owns chain allocation.
             */
            delete normalizedPayload.sequence;
            delete normalizedPayload.previousHash;
            delete normalizedPayload.immutableHash;
            delete normalizedPayload._id;

            const document =
                new this(
                    normalizedPayload
                );

            return await document.save();
        } catch (error) {
            /**
             * Duplicate idempotency race.
             */
            if (
                error &&
                error.code === 11000 &&
                normalizedPayload.idempotencyKey
            ) {
                const existing =
                    await this.findOne({
                        tenantId:
                            normalizedPayload.tenantId,
                        idempotencyKey:
                            normalizedPayload.idempotencyKey
                    });

                if (existing) {
                    return existing;
                }
            }

            /**
             * Duplicate sequence race.
             */
            const duplicateSequence =
                error &&
                error.code === 11000 &&
                (
                    String(
                        error.message || ""
                    ).includes(
                        "uq_loan_audit_tenant_loan_sequence"
                    ) ||
                    String(
                        error.message || ""
                    ).includes(
                        "tenantId_1_loanId_1_sequence_1"
                    )
                );

            if (
                duplicateSequence &&
                attempt < maxAttempts
            ) {
                continue;
            }

            throw error;
        }
    }

    throw new Error(
        "Unable to allocate a unique audit sequence"
    );
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
LoanAuditSchema.statics.countTenantEvents =
function countTenantEvents(
    tenantId,
    filter = {}
) {
    const normalizedTenantId =
        requireNonEmptyString(
            tenantId,
            "tenantId"
        );

    const sanitizedFilter =
        sanitizeCountFilter(
            filter
        );

    return this.countDocuments({
        tenantId:
            normalizedTenantId,
        ...sanitizedFilter
    });
};

/**
 * ============================================================================
 * Static: Assert Audit Record Integrity
 * ============================================================================
 *
 * Throws instead of returning false, making it suitable for compliance and
 * operational verification flows.
 *
 * @param {Object} auditDocument
 * @returns {true}
 */
LoanAuditSchema.statics.assertIntegrity =
function assertIntegrity(
    auditDocument
) {
    if (
        !this.verifyIntegrity(
            auditDocument
        )
    ) {
        throw new Error(
            "Loan audit integrity verification failed"
        );
    }

    return true;
};

/**
 * ============================================================================
 * JSON Serialization
 * ============================================================================
 */

LoanAuditSchema.set(
    "toJSON",
    {
        virtuals: true,

        transform(
            doc,
            ret
        ) {
            delete ret.__v;

            return ret;
        }
    }
);

/**
 * ============================================================================
 * Model Export
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
 * Domain vocabulary exports.
 */
module.exports.ACTOR_TYPES =
    ACTOR_TYPES;

module.exports.EVENT_TYPES =
    EVENT_TYPES;

module.exports.PROVIDERS =
    PROVIDERS;

/**
 * Optional testing and integrity helpers.
 *
 * These are intentionally non-persistence helpers and do not expose mutation
 * capabilities.
 */
module.exports.buildIntegrityPayload =
    buildIntegrityPayload;

module.exports.generateIntegrityHash =
    generateIntegrityHash;

module.exports.stableStringify =
    stableStringify;

module.exports.MAX_PAGE_SIZE =
    MAX_PAGE_SIZE;

module.exports.DEFAULT_PAGE_SIZE =
    DEFAULT_PAGE_SIZE;