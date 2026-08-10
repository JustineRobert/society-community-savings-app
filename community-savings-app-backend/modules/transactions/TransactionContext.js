'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Context
 * ============================================================================
 *
 * Maintains execution context for distributed financial transactions.
 *
 * Responsibilities
 * ----------------
 * • Transaction Identity
 * • Correlation Tracking
 * • Tenant Context
 * • Authentication Context
 * • Audit Context
 * • Tracing Context
 * • Idempotency
 * • Performance Metrics
 * • Metadata Propagation
 * • Event Correlation
 *
 * ============================================================================
 */

const crypto = require('crypto');

const TransactionStates = Object.freeze({
    CREATED: 'CREATED',
    RUNNING: 'RUNNING',
    COMMITTED: 'COMMITTED',
    ROLLING_BACK: 'ROLLING_BACK',
    ROLLED_BACK: 'ROLLED_BACK',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
});

class TransactionContext {

    constructor(options = {}) {

        this.transactionId =
            options.transactionId ||
            crypto.randomUUID();

        this.parentTransactionId =
            options.parentTransactionId ||
            null;

        this.correlationId =
            options.correlationId ||
            this.transactionId;

        this.requestId =
            options.requestId ||
            null;

        this.idempotencyKey =
            options.idempotencyKey ||
            null;

        this.tenantId =
            options.tenantId ||
            null;

        this.organizationId =
            options.organizationId ||
            null;

        this.userId =
            options.userId ||
            null;

        this.sessionId =
            options.sessionId ||
            null;

        this.service =
            options.service ||
            'transactions';

        this.operation =
            options.operation ||
            'unknown';

        this.source =
            options.source ||
            'internal';

        this.state =
            options.state ||
            TransactionStates.CREATED;

        this.priority =
            options.priority ||
            'NORMAL';

        this.createdAt = new Date();

        this.startedAt = null;

        this.completedAt = null;

        this.tags = new Map();

        this.attributes = new Map();

        this.metadata = new Map();

        this.audit = {

            ipAddress:
                options.ipAddress || null,

            userAgent:
                options.userAgent || null,

            deviceId:
                options.deviceId || null,

            initiatedBy:
                options.initiatedBy ||
                options.userId ||
                'system'

        };

        this.trace = {

            traceId:
                options.traceId ||
                null,

            spanId:
                options.spanId ||
                null,

            parentSpanId:
                options.parentSpanId ||
                null

        };

        this.statistics = {

            retries: 0,

            operations: 0,

            rollbackOperations: 0,

            warnings: 0,

            errors: 0

        };
    }

    /**
     * =========================================================================
     * Lifecycle
     * =========================================================================
     */

    start() {

        this.startedAt = new Date();

        this.state = TransactionStates.RUNNING;

        return this;

    }

    commit() {

        this.completedAt = new Date();

        this.state = TransactionStates.COMMITTED;

        return this;

    }

    rollback() {

        this.completedAt = new Date();

        this.state = TransactionStates.ROLLED_BACK;

        return this;

    }

    fail(error) {

        this.completedAt = new Date();

        this.state = TransactionStates.FAILED;

        this.lastError = {

            message: error?.message,

            name: error?.name,

            code: error?.code,

            timestamp: new Date()

        };

        this.statistics.errors++;

        return this;

    }

    cancel() {

        this.completedAt = new Date();

        this.state = TransactionStates.CANCELLED;

        return this;

    }

    /**
     * =========================================================================
     * Metadata
     * =========================================================================
     */

    set(key, value) {

        this.metadata.set(key, value);

        return this;

    }

    get(key) {

        return this.metadata.get(key);

    }

    has(key) {

        return this.metadata.has(key);

    }

    delete(key) {

        this.metadata.delete(key);

        return this;

    }

    /**
     * =========================================================================
     * Tags
     * =========================================================================
     */

    addTag(name, value = true) {

        this.tags.set(name, value);

        return this;

    }

    getTag(name) {

        return this.tags.get(name);

    }

    /**
     * =========================================================================
     * Attributes
     * =========================================================================
     */

    setAttribute(name, value) {

        this.attributes.set(name, value);

        return this;

    }

    getAttribute(name) {

        return this.attributes.get(name);

    }

    /**
     * =========================================================================
     * Statistics
     * =========================================================================
     */

    incrementOperations() {

        this.statistics.operations++;

        return this;

    }

    incrementRollbackOperations() {

        this.statistics.rollbackOperations++;

        return this;

    }

    incrementRetries() {

        this.statistics.retries++;

        return this;

    }

    incrementWarnings() {

        this.statistics.warnings++;

        return this;

    }

    /**
     * =========================================================================
     * Duration
     * =========================================================================
     */

    getDuration() {

        if (!this.startedAt) {

            return 0;

        }

        const end =
            this.completedAt ||
            new Date();

        return end.getTime() - this.startedAt.getTime();

    }

    /**
     * =========================================================================
     * Logging
     * =========================================================================
     */

    toLogObject() {

        return {

            transactionId: this.transactionId,

            correlationId: this.correlationId,

            requestId: this.requestId,

            tenantId: this.tenantId,

            organizationId: this.organizationId,

            userId: this.userId,

            operation: this.operation,

            service: this.service,

            state: this.state,

            durationMs: this.getDuration()

        };

    }

    /**
     * =========================================================================
     * Event Payload
     * =========================================================================
     */

    toEvent() {

        return {

            transactionId: this.transactionId,

            correlationId: this.correlationId,

            tenantId: this.tenantId,

            requestId: this.requestId,

            operation: this.operation,

            service: this.service,

            state: this.state,

            timestamp: new Date()

        };

    }

    /**
     * =========================================================================
     * Serialization
     * =========================================================================
     */

    toJSON() {

        return {

            transactionId: this.transactionId,

            parentTransactionId: this.parentTransactionId,

            correlationId: this.correlationId,

            requestId: this.requestId,

            idempotencyKey: this.idempotencyKey,

            tenantId: this.tenantId,

            organizationId: this.organizationId,

            userId: this.userId,

            sessionId: this.sessionId,

            service: this.service,

            operation: this.operation,

            source: this.source,

            priority: this.priority,

            state: this.state,

            createdAt: this.createdAt,

            startedAt: this.startedAt,

            completedAt: this.completedAt,

            durationMs: this.getDuration(),

            tags: Object.fromEntries(this.tags),

            attributes: Object.fromEntries(this.attributes),

            metadata: Object.fromEntries(this.metadata),

            audit: this.audit,

            trace: this.trace,

            statistics: this.statistics,

            lastError: this.lastError || null

        };

    }

    /**
     * =========================================================================
     * Clone
     * =========================================================================
     */

    clone() {

        return new TransactionContext({

            ...this.toJSON()

        });

    }

    /**
     * =========================================================================
     * Factory
     * =========================================================================
     */

    static create(options = {}) {

        return new TransactionContext(options);

    }

}

TransactionContext.States = TransactionStates;

module.exports = TransactionContext;