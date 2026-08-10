'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Repository
 * ============================================================================
 *
 * Responsibilities
 * ----------------
 * • Persist transactions
 * • Retrieve transactions
 * • Update transaction state
 * • Idempotency lookups
 * • Correlation tracking
 * • Tenant isolation
 * • Optimistic concurrency
 * • Soft delete
 * • Audit metadata
 *
 * ============================================================================
 */

class TransactionRepository {

    constructor(options = {}) {

        if (!options.model) {
            throw new Error('TransactionRepository requires a transaction model.');
        }

        this.model = options.model;

        this.logger = options.logger || console;

        this.metrics = options.metrics;

        this.tracer = options.tracer;
    }

    /**
     * =========================================================================
     * Create
     * =========================================================================
     */

    async create(transaction, options = {}) {

        const span =
            this.tracer?.startSpan?.('transaction.repository.create');

        try {

            const document = new this.model({

                ...transaction,

                createdAt: transaction.createdAt || new Date(),

                updatedAt: new Date(),

                version: transaction.version || 1,

                isDeleted: false

            });

            const saved = await document.save(options);

            this.metrics?.increment?.(
                'transaction_repository_create_total'
            );

            return saved;

        } finally {

            span?.end?.();

        }

    }

    /**
     * =========================================================================
     * Find by Transaction ID
     * =========================================================================
     */

    async findByTransactionId(transactionId, options = {}) {

        return this.model.findOne({

            transactionId,

            isDeleted: { $ne: true }

        }, null, options);

    }

    /**
     * =========================================================================
     * Find by Database ID
     * =========================================================================
     */

    async findById(id, options = {}) {

        return this.model.findOne({

            _id: id,

            isDeleted: { $ne: true }

        }, null, options);

    }

    /**
     * =========================================================================
     * Find by Idempotency Key
     * =========================================================================
     */

    async findByIdempotencyKey(idempotencyKey, tenantId) {

        return this.model.findOne({

            idempotencyKey,

            tenantId,

            isDeleted: { $ne: true }

        });

    }

    /**
     * =========================================================================
     * Find by Correlation ID
     * =========================================================================
     */

    async findByCorrelationId(correlationId) {

        return this.model.find({

            correlationId,

            isDeleted: { $ne: true }

        }).sort({

            createdAt: 1

        });

    }

    /**
     * =========================================================================
     * Update State
     * =========================================================================
     */

    async updateState(transactionId, state, metadata = {}) {

        const update = {

            state,

            updatedAt: new Date(),

            $inc: {

                version: 1

            }

        };

        if (metadata.lastError) {

            update.lastError = metadata.lastError;

        }

        return this.model.findOneAndUpdate(

            {

                transactionId,

                isDeleted: { $ne: true }

            },

            update,

            {

                new: true

            }

        );

    }

    /**
     * =========================================================================
     * Save
     * =========================================================================
     */

    async save(transaction) {

        transaction.updatedAt = new Date();

        transaction.version =
            (transaction.version || 0) + 1;

        return transaction.save();

    }

    /**
     * =========================================================================
     * Replace
     * =========================================================================
     */

    async replace(transactionId, replacement) {

        replacement.updatedAt = new Date();

        return this.model.findOneAndReplace(

            {

                transactionId,

                isDeleted: { $ne: true }

            },

            replacement,

            {

                new: true,

                upsert: false

            }

        );

    }

    /**
     * =========================================================================
     * Soft Delete
     * =========================================================================
     */

    async delete(transactionId) {

        return this.model.findOneAndUpdate(

            {

                transactionId

            },

            {

                isDeleted: true,

                deletedAt: new Date()

            },

            {

                new: true

            }

        );

    }

    /**
     * =========================================================================
     * Restore
     * =========================================================================
     */

    async restore(transactionId) {

        return this.model.findOneAndUpdate(

            {

                transactionId

            },

            {

                isDeleted: false,

                deletedAt: null

            },

            {

                new: true

            }

        );

    }

    /**
     * =========================================================================
     * Exists
     * =========================================================================
     */

    async exists(transactionId) {

        return this.model.exists({

            transactionId,

            isDeleted: { $ne: true }

        });

    }

    /**
     * =========================================================================
     * List
     * =========================================================================
     */

    async list(filter = {}, options = {}) {

        const page =
            Math.max(1, options.page || 1);

        const limit =
            Math.min(500, options.limit || 50);

        const skip =
            (page - 1) * limit;

        const query = {

            ...filter,

            isDeleted: { $ne: true }

        };

        const [items, total] =
            await Promise.all([

                this.model
                    .find(query)
                    .sort(options.sort || { createdAt: -1 })
                    .skip(skip)
                    .limit(limit),

                this.model.countDocuments(query)

            ]);

        return {

            items,

            pagination: {

                page,

                limit,

                total,

                pages: Math.ceil(total / limit)

            }

        };

    }

    /**
     * =========================================================================
     * Bulk Insert
     * =========================================================================
     */

    async bulkCreate(transactions) {

        if (!transactions.length) {

            return [];

        }

        return this.model.insertMany(

            transactions.map(t => ({

                ...t,

                createdAt: t.createdAt || new Date(),

                updatedAt: new Date(),

                isDeleted: false,

                version: 1

            })),

            {

                ordered: true

            }

        );

    }

    /**
     * =========================================================================
     * Bulk Update State
     * =========================================================================
     */

    async bulkUpdateState(transactionIds, state) {

        return this.model.updateMany(

            {

                transactionId: {

                    $in: transactionIds

                }

            },

            {

                $set: {

                    state,

                    updatedAt: new Date()

                },

                $inc: {

                    version: 1

                }

            }

        );

    }

    /**
     * =========================================================================
     * Count
     * =========================================================================
     */

    async count(filter = {}) {

        return this.model.countDocuments({

            ...filter,

            isDeleted: { $ne: true }

        });

    }

    /**
     * =========================================================================
     * Transaction History
     * =========================================================================
     */

    async history(transactionId) {

        return this.model.findOne(

            {

                transactionId,

                isDeleted: { $ne: true }

            },

            {

                history: 1,

                state: 1,

                transactionId: 1

            }

        );

    }

    /**
     * =========================================================================
     * Optimistic Concurrency Update
     * =========================================================================
     */

    async updateWithVersion(transactionId, version, update) {

        update.updatedAt = new Date();

        update.$inc = {

            version: 1

        };

        return this.model.findOneAndUpdate(

            {

                transactionId,

                version,

                isDeleted: { $ne: true }

            },

            update,

            {

                new: true

            }

        );

    }

}

module.exports = TransactionRepository;