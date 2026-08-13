'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Payment Execution Context
 * ============================================================================
 *
 * Canonical request context shared across:
 *
 *  • Airtel Money
 *  • MTN MoMo
 *  • Payment orchestration
 *  • Authentication
 *  • Idempotency
 *  • Callback processing
 *  • Settlement
 *  • Reconciliation
 *  • Ledger integration
 *  • Audit logging
 *  • Metrics
 *  • Distributed tracing
 *
 * Design Goals
 * ------------
 * • Immutable execution identity
 * • Tenant isolation
 * • Correlation propagation
 * • Idempotency propagation
 * • Provider/operation identification
 * • Safe diagnostics
 * • Context fingerprinting
 * • Child context support
 * • Serialization
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Payment execution
 * • Authentication
 * • Ledger posting
 * • Credential storage
 * • Provider communication
 *
 * ============================================================================
 */

const crypto = require('crypto');


/**
 * ============================================================================
 * Constants
 * ============================================================================
 */

const CONTEXT_VERSION =
    '1.0';

const MAX_STRING_LENGTH =
    512;

const MAX_METADATA_KEYS =
    50;

const RESERVED_METADATA_KEYS =
    new Set([
        'password',
        'secret',
        'clientSecret',
        'accessToken',
        'refreshToken',
        'authorization',
        'token',
        'apiKey',
        'privateKey',
    ]);


/**
 * ============================================================================
 * Utilities
 * ============================================================================
 */

function generateId() {
    return crypto.randomUUID();
}


function normalizeRequiredString(
    value,
    field
) {
    if (
        typeof value !== 'string' ||
        value.trim() === ''
    ) {
        throw new TypeError(
            `${field} is required`
        );
    }

    const normalized =
        value.trim();

    if (
        normalized.length >
        MAX_STRING_LENGTH
    ) {
        throw new RangeError(
            `${field} exceeds maximum length`
        );
    }

    return normalized;
}


function normalizeOptionalString(
    value,
    field
) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return null;
    }

    if (typeof value !== 'string') {
        throw new TypeError(
            `${field} must be a string`
        );
    }

    const normalized =
        value.trim();

    if (
        normalized.length >
        MAX_STRING_LENGTH
    ) {
        throw new RangeError(
            `${field} exceeds maximum length`
        );
    }

    return normalized || null;
}


function sanitizeMetadata(
    metadata = {}
) {
    if (
        metadata === null ||
        metadata === undefined
    ) {
        return Object.freeze({});
    }

    if (
        typeof metadata !== 'object' ||
        Array.isArray(metadata)
    ) {
        throw new TypeError(
            'metadata must be an object'
        );
    }

    const entries =
        Object.entries(metadata);

    if (
        entries.length >
        MAX_METADATA_KEYS
    ) {
        throw new RangeError(
            `metadata cannot contain more than ${MAX_METADATA_KEYS} keys`
        );
    }

    const result = {};

    for (
        const [key, value]
        of entries
    ) {
        if (
            RESERVED_METADATA_KEYS.has(
                key
            )
        ) {
            throw new Error(
                `Sensitive metadata field is not permitted: ${key}`
            );
        }

        if (
            typeof value === 'function' ||
            typeof value === 'symbol'
        ) {
            throw new TypeError(
                `Unsupported metadata value for ${key}`
            );
        }

        result[key] =
            value;
    }

    return Object.freeze(
        result
    );
}


/**
 * ============================================================================
 * Payment Context
 * ============================================================================
 */

class PaymentContext {

    constructor({

        tenantId,

        userId = null,

        provider,

        operation,

        correlationId = null,

        idempotencyKey = null,

        requestId = null,

        parentRequestId = null,

        metadata = {},

        createdAt = null,

        contextVersion =
            CONTEXT_VERSION,

    } = {}) {

        /**
         * --------------------------------------------------------------------
         * Validate mandatory identity
         * --------------------------------------------------------------------
         */

        this._tenantId =
            normalizeRequiredString(
                tenantId,
                'tenantId'
            );

        this._provider =
            normalizeRequiredString(
                provider,
                'provider'
            )
            .toUpperCase();

        this._operation =
            normalizeRequiredString(
                operation,
                'operation'
            );


        /**
         * --------------------------------------------------------------------
         * Optional identity
         * --------------------------------------------------------------------
         */

        this._userId =
            normalizeOptionalString(
                userId,
                'userId'
            );


        /**
         * --------------------------------------------------------------------
         * Request identity
         * --------------------------------------------------------------------
         *
         * requestId identifies one concrete execution/request.
         *
         * correlationId connects multiple related operations across
         * services, retries, callbacks and asynchronous workflows.
         */

        this._requestId =
            requestId
                ? normalizeRequiredString(
                    requestId,
                    'requestId'
                )
                : generateId();


        this._correlationId =
            correlationId
                ? normalizeRequiredString(
                    correlationId,
                    'correlationId'
                )
                : this._requestId;


        this._parentRequestId =
            normalizeOptionalString(
                parentRequestId,
                'parentRequestId'
            );


        /**
         * --------------------------------------------------------------------
         * Idempotency
         * --------------------------------------------------------------------
         */

        this._idempotencyKey =
            normalizeOptionalString(
                idempotencyKey,
                'idempotencyKey'
            );


        /**
         * --------------------------------------------------------------------
         * Context metadata
         * --------------------------------------------------------------------
         */

        this._metadata =
            sanitizeMetadata(
                metadata
            );


        /**
         * --------------------------------------------------------------------
         * Context version
         * --------------------------------------------------------------------
         */

        this._contextVersion =
            normalizeRequiredString(
                contextVersion,
                'contextVersion'
            );


        /**
         * --------------------------------------------------------------------
         * Timestamp
         * --------------------------------------------------------------------
         */

        this._createdAt =
            createdAt
                ? new Date(createdAt)
                : new Date();


        if (
            Number.isNaN(
                this._createdAt.getTime()
            )
        ) {
            throw new TypeError(
                'createdAt must be a valid date'
            );
        }


        /**
         * --------------------------------------------------------------------
         * Freeze nested metadata and the context itself
         * --------------------------------------------------------------------
         */

        Object.freeze(
            this._metadata
        );


        Object.freeze(
            this
        );
    }


    /**
     * =========================================================================
     * Accessors
     * =========================================================================
     */

    get requestId() {
        return this._requestId;
    }


    get tenantId() {
        return this._tenantId;
    }


    get userId() {
        return this._userId;
    }


    get provider() {
        return this._provider;
    }


    get operation() {
        return this._operation;
    }


    get correlationId() {
        return this._correlationId;
    }


    get idempotencyKey() {
        return this._idempotencyKey;
    }


    get parentRequestId() {
        return this._parentRequestId;
    }


    get contextVersion() {
        return this._contextVersion;
    }


    get createdAt() {
        return this._createdAt;
    }


    get metadata() {
        return this._metadata;
    }


    /**
     * =========================================================================
     * Idempotency Requirement
     * =========================================================================
     */

    requiresIdempotency() {

        return Boolean(
            this._idempotencyKey
        );
    }


    /**
     * =========================================================================
     * Context Fingerprint
     * =========================================================================
     *
     * Used for diagnostics and correlation.
     *
     * Do NOT use this as the idempotency key itself.
     */

    fingerprint() {

        const canonical = {

            tenantId:
                this._tenantId,

            userId:
                this._userId,

            provider:
                this._provider,

            operation:
                this._operation,

            correlationId:
                this._correlationId,

            idempotencyKey:
                this._idempotencyKey,

            parentRequestId:
                this._parentRequestId,

            contextVersion:
                this._contextVersion,
        };


        return crypto
            .createHash('sha256')
            .update(
                JSON.stringify(
                    canonical
                ),
                'utf8'
            )
            .digest('hex');
    }


    /**
     * =========================================================================
     * Child Context
     * =========================================================================
     *
     * Useful when one payment operation invokes a downstream operation.
     *
     * Example:
     *
     * Payment request
     *      ↓
     * Airtel authentication
     *      ↓
     * Provider request
     */

    child({

        operation,

        provider = this._provider,

        userId = this._userId,

        idempotencyKey =
            this._idempotencyKey,

        metadata = {},

    } = {}) {

        return new PaymentContext({

            tenantId:
                this._tenantId,

            userId,

            provider,

            operation,

            correlationId:
                this._correlationId,

            idempotencyKey,

            parentRequestId:
                this._requestId,

            metadata: {
                ...this._metadata,
                ...metadata,
            },

            contextVersion:
                this._contextVersion,
        });
    }


    /**
     * =========================================================================
     * Safe Diagnostic Representation
     * =========================================================================
     */

    toJSON() {

        return {
            contextVersion:
                this._contextVersion,

            requestId:
                this._requestId,

            parentRequestId:
                this._parentRequestId,

            tenantId:
                this._tenantId,

            userId:
                this._userId,

            provider:
                this._provider,

            operation:
                this._operation,

            correlationId:
                this._correlationId,

            idempotencyKey:
                this._idempotencyKey,

            createdAt:
                this._createdAt,

            metadata:
                this._metadata,

            fingerprint:
                this.fingerprint(),
        };
    }


    /**
     * =========================================================================
     * Safe Logging Representation
     * =========================================================================
     *
     * Intentionally excludes the idempotency key.
     *
     * Idempotency keys can sometimes contain business identifiers supplied by
     * clients and should not automatically become part of general logs.
     */

    toLogContext() {

        return {
            contextVersion:
                this._contextVersion,

            requestId:
                this._requestId,

            parentRequestId:
                this._parentRequestId,

            tenantId:
                this._tenantId,

            userId:
                this._userId,

            provider:
                this._provider,

            operation:
                this._operation,

            correlationId:
                this._correlationId,

            contextFingerprint:
                this.fingerprint(),
        };
    }


    /**
     * =========================================================================
     * Static Factory
     * =========================================================================
     */

    static create(options = {}) {

        return new PaymentContext(
            options
        );
    }


    /**
     * =========================================================================
     * Static Validation
     * =========================================================================
     */

    static isValid(context) {

        return (
            context instanceof
            PaymentContext
        );
    }

}


/**
 * ============================================================================
 * Exports
 * ============================================================================
 */

module.exports =
    PaymentContext;

module.exports.PaymentContext =
    PaymentContext;

module.exports.CONTEXT_VERSION =
    CONTEXT_VERSION;