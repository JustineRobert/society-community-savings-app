'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Finance Core - Statement Model
 * ============================================================================
 *
 * Immutable financial statement source record.
 *
 * Architectural Rules
 * ----------------------------------------------------------------------------
 *
 * • Statement source data is immutable after creation.
 * • Processing lifecycle may transition only through approved states.
 * • Tenant isolation is mandatory.
 * • operationKey is the deterministic coordination key.
 * • No direct financial balance mutation is permitted here.
 * • Statement ingestion does NOT post to the ledger.
 * • Actual accounting remains the responsibility of the Ledger Engine.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');

const {
    Schema
} = mongoose;

/**
 * ============================================================================
 * Constants
 * ============================================================================
 */

const PROCESSING_STATUS = Object.freeze({

    RECEIVED: 'RECEIVED',

    PROCESSING: 'PROCESSING',

    IMPORTED: 'IMPORTED',

    NORMALIZED: 'NORMALIZED',

    VALIDATED: 'VALIDATED',

    PERSISTED: 'PERSISTED',

    BATCHED: 'BATCHED',

    COMPLETED: 'COMPLETED',

    DUPLICATE: 'DUPLICATE',

    PARTIAL: 'PARTIAL',

    FAILED: 'FAILED'
});

const SOURCE_TYPES = Object.freeze({

    BANK: 'BANK',

    MTN_MOMO: 'MTN_MOMO',

    AIRTEL_MONEY: 'AIRTEL_MONEY',

    MANUAL: 'MANUAL',

    API: 'API',

    FILE: 'FILE',

    UNKNOWN: 'UNKNOWN'
});

const ALLOWED_STATUS_TRANSITIONS = Object.freeze({

    RECEIVED: new Set([
        PROCESSING,
        DUPLICATE,
        FAILED
    ]),

    PROCESSING: new Set([
        IMPORTED,
        FAILED,
        DUPLICATE
    ]),

    IMPORTED: new Set([
        NORMALIZED,
        FAILED
    ]),

    NORMALIZED: new Set([
        VALIDATED,
        FAILED
    ]),

    VALIDATED: new Set([
        PERSISTED,
        FAILED
    ]),

    PERSISTED: new Set([
        BATCHED,
        COMPLETED,
        PARTIAL,
        FAILED
    ]),

    BATCHED: new Set([
        COMPLETED,
        PARTIAL,
        FAILED
    ]),

    PARTIAL: new Set([
        COMPLETED,
        FAILED
    ]),

    COMPLETED: new Set(),

    DUPLICATE: new Set(),

    FAILED: new Set([
        PROCESSING
    ])
});

/**
 * ============================================================================
 * Statement Transaction Schema
 * ============================================================================
 */

const StatementTransactionSchema =
    new Schema(
        {
            externalId: {
                type: String,
                required: true,
                immutable: true,
                trim: true,
                maxlength: 256
            },

            reference: {
                type: String,
                trim: true,
                maxlength: 256,
                immutable: true
            },

            amount: {
                type: Schema.Types.Decimal128,
                required: true,
                immutable: true
            },

            currency: {
                type: String,
                required: true,
                immutable: true,
                uppercase: true,
                trim: true,
                minlength: 3,
                maxlength: 3
            },

            transactionDate: {
                type: Date,
                required: true,
                immutable: true
            },

            valueDate: {
                type: Date,
                immutable: true
            },

            description: {
                type: String,
                trim: true,
                maxlength: 2000,
                immutable: true
            },

            direction: {
                type: String,
                enum: [
                    'DEBIT',
                    'CREDIT',
                    'UNKNOWN'
                ],
                default: 'UNKNOWN',
                immutable: true
            },

            balanceAfter: {
                type: Schema.Types.Decimal128,
                immutable: true
            },

            providerReference: {
                type: String,
                trim: true,
                maxlength: 256,
                immutable: true
            },

            metadata: {
                type: Schema.Types.Mixed,
                immutable: true
            }
        },
        {
            _id: false,
            strict: true
        }
    );

/**
 * ============================================================================
 * Statement Schema
 * ============================================================================
 */

const StatementSchema =
    new Schema(
        {
            /**
             * Tenant boundary.
             */
            tenantId: {
                type: String,
                required: true,
                trim: true,
                immutable: true,
                index: true
            },

            /**
             * Stable statement identity inside a tenant.
             */
            statementId: {
                type: String,
                required: true,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            /**
             * Deterministic coordination key.
             *
             * Unique per tenant.
             */
            operationKey: {
                type: String,
                required: true,
                trim: true,
                immutable: true,
                maxlength: 512
            },

            /**
             * Idempotency key supplied by upstream orchestration.
             */
            idempotencyKey: {
                type: String,
                required: true,
                trim: true,
                immutable: true,
                maxlength: 512
            },

            /**
             * Originating provider.
             */
            provider: {
                type: String,
                enum: Object.values(SOURCE_TYPES),
                default: SOURCE_TYPES.UNKNOWN,
                immutable: true,
                uppercase: true,
                trim: true
            },

            /**
             * External provider identifiers.
             */
            providerStatementId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            providerBatchId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            providerReference: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            externalReference: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            /**
             * Statement source.
             */
            source: {
                type: String,
                enum: Object.values(SOURCE_TYPES),
                default: SOURCE_TYPES.UNKNOWN,
                immutable: true,
                uppercase: true,
                trim: true
            },

            /**
             * Statement-level accounting information.
             */
            currency: {
                type: String,
                uppercase: true,
                trim: true,
                minlength: 3,
                maxlength: 3,
                immutable: true
            },

            statementDate: {
                type: Date,
                immutable: true
            },

            periodStart: {
                type: Date,
                immutable: true
            },

            periodEnd: {
                type: Date,
                immutable: true
            },

            /**
             * Canonical imported transactions.
             *
             * These are immutable source transactions.
             */
            transactions: {
                type: [StatementTransactionSchema],
                default: []
            },

            /**
             * Processing lifecycle.
             */
            processingStatus: {
                type: String,
                enum: Object.values(PROCESSING_STATUS),
                default: PROCESSING_STATUS.RECEIVED,
                required: true,
                index: true
            },

            /**
             * Processing metadata.
             *
             * Operational metadata may be updated through guarded repository
             * methods. Financial source data must never be placed here.
             */
            processingMetadata: {
                type: Schema.Types.Mixed,
                default: {}
            },

            /**
             * Hash of canonical input.
             */
            inputFingerprint: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 128
            },

            /**
             * Distributed trace correlation.
             */
            pipelineId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            statementTraceId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            correlationId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            requestId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            operationId: {
                type: String,
                trim: true,
                immutable: true,
                maxlength: 256
            },

            /**
             * Batch reference.
             *
             * Batch assignment is operational metadata and may be assigned
             * after statement creation.
             */
            batchId: {
                type: String,
                trim: true,
                maxlength: 256,
                index: true
            },

            /**
             * Processing timestamps.
             */
            receivedAt: {
                type: Date,
                default: Date.now,
                immutable: true
            },

            importedAt: {
                type: Date,
                immutable: true
            },

            normalizedAt: {
                type: Date,
                immutable: true
            },

            validatedAt: {
                type: Date,
                immutable: true
            },

            persistedAt: {
                type: Date,
                immutable: true
            },

            completedAt: {
                type: Date
            },

            failedAt: {
                type: Date
            },

            /**
             * Last processing error metadata.
             */
            lastError: {
                code: {
                    type: String,
                    maxlength: 256
                },

                message: {
                    type: String,
                    maxlength: 2000
                },

                stage: {
                    type: String,
                    maxlength: 128
                },

                retryable: {
                    type: Boolean,
                    default: false
                }
            },

            /**
             * Processing attempt count.
             */
            attemptCount: {
                type: Number,
                default: 0,
                min: 0
            },

            version: {
                type: Number,
                default: 1,
                min: 1
            }
        },
        {
            timestamps: true,
            strict: true,
            minimize: false,
            optimisticConcurrency: true,
            versionKey: '__v'
        }
    );

/**
 * ============================================================================
 * Indexes
 * ============================================================================
 *
 * operationKey is unique inside a tenant.
 */

StatementSchema.index(
    {
        tenantId: 1,
        operationKey: 1
    },
    {
        unique: true,
        name:
            'uq_statement_tenant_operation_key'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        idempotencyKey: 1
    },
    {
        unique: true,
        name:
            'uq_statement_tenant_idempotency_key'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        provider: 1,
        providerStatementId: 1
    },
    {
        unique: true,
        sparse: true,
        name:
            'uq_statement_provider_statement'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        provider: 1,
        providerReference: 1
    },
    {
        unique: true,
        sparse: true,
        name:
            'uq_statement_provider_reference'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        processingStatus: 1,
        receivedAt: -1
    },
    {
        name:
            'ix_statement_processing_status'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        batchId: 1,
        receivedAt: 1
    },
    {
        name:
            'ix_statement_batch'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        statementDate: -1
    },
    {
        name:
            'ix_statement_date'
    }
);

StatementSchema.index(
    {
        tenantId: 1,
        createdAt: -1
    },
    {
        name:
            'ix_statement_created_at'
    }
);

/**
 * ============================================================================
 * Validation
 * ============================================================================
 */

StatementSchema.path(
    'transactions'
).validate(
    function validateTransactions() {

        if (!Array.isArray(
            this.transactions
        )) {

            return false;
        }

        const externalIds =
            new Set();

        for (
            const transaction
            of this.transactions
        ) {

            if (!transaction.externalId) {

                return false;
            }

            if (
                externalIds.has(
                    transaction.externalId
                )
            ) {

                return false;
            }

            externalIds.add(
                transaction.externalId
            );
        }

        return true;
    },
    'Statement transactions must contain unique external IDs'
);

/**
 * ============================================================================
 * Immutable Update Protection
 * ============================================================================
 *
 * Mongoose `immutable` provides document-level protection, but update
 * operations can still be dangerous if arbitrary update operators are used.
 *
 * The repository therefore performs a second layer of field protection.
 * This hook additionally blocks dangerous direct update paths at model level.
 * ============================================================================
 */

const IMMUTABLE_PATHS = Object.freeze([

    'tenantId',

    'statementId',

    'operationKey',

    'idempotencyKey',

    'provider',

    'providerStatementId',

    'providerBatchId',

    'providerReference',

    'externalReference',

    'source',

    'currency',

    'statementDate',

    'periodStart',

    'periodEnd',

    'transactions',

    'inputFingerprint',

    'pipelineId',

    'statementTraceId',

    'correlationId',

    'requestId',

    'operationId',

    'receivedAt',

    'importedAt',

    'normalizedAt',

    'validatedAt',

    'persistedAt',

    'attemptCount'
]);

function guardImmutableUpdate(
    next
) {

    const update =
        next.getUpdate?.() ||
        {};

    const forbidden =
        new Set();

    const inspectObject =
        object => {

            if (
                !object ||
                typeof object !== 'object'
            ) {

                return;
            }

            for (
                const key
                of Object.keys(object)
            ) {

                const normalized =
                    key.startsWith('$')
                        ? key
                        : key;

                if (
                    IMMUTABLE_PATHS.includes(
                        normalized
                    )
                ) {

                    forbidden.add(
                        normalized
                    );

                    continue;
                }

                if (
                    normalized.startsWith('$')
                ) {

                    inspectObject(
                        object[key]
                    );
                }
            }
        };

    inspectObject(update);

    if (forbidden.size > 0) {

        throw new Error(
            `Immutable statement fields cannot be modified: ${
                Array.from(
                    forbidden
                ).join(', ')
            }`
        );
    }
}

for (
    const hook of [
        'updateOne',
        'updateMany',
        'findOneAndUpdate',
        'findByIdAndUpdate'
    ]
) {

    StatementSchema.pre(
        hook,
        function immutableUpdateGuard(
            next
        ) {

            try {

                guardImmutableUpdate(
                    this
                );

                next();

            }
            catch (error) {

                next(error);
            }
        }
    );
}

/**
 * ============================================================================
 * State Transition Helper
 * ============================================================================
 */

StatementSchema.statics.isValidStatusTransition =
    function isValidStatusTransition(
        from,
        to
    ) {

        if (
            !Object.values(
                PROCESSING_STATUS
            ).includes(
                from
            )
        ) {

            return false;
        }

        if (
            !Object.values(
                PROCESSING_STATUS
            ).includes(
                to
            )
        ) {

            return false;
        }

        return (
            ALLOWED_STATUS_TRANSITIONS[
                from
            ]?.has(to) ||
            false
        );
    };

/**
 * ============================================================================
 * Static Exports
 * ============================================================================
 */

StatementSchema.statics.PROCESSING_STATUS =
    PROCESSING_STATUS;

StatementSchema.statics.SOURCE_TYPES =
    SOURCE_TYPES;

StatementSchema.statics.ALLOWED_STATUS_TRANSITIONS =
    ALLOWED_STATUS_TRANSITIONS;

/**
 * ============================================================================
 * Model
 * ============================================================================
 */

const Statement =
    mongoose.models.Statement ||
    mongoose.model(
        'Statement',
        StatementSchema
    );

module.exports =
    Statement;