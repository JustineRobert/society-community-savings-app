'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Payment Engine Error
 * ============================================================================
 *
 * Enterprise domain error for the payment engine.
 *
 * Responsibilities
 * ----------------
 * • Stable machine-readable error codes
 * • Human-readable error messages
 * • Error classification
 * • HTTP status mapping
 * • Retry classification
 * • Provider context
 * • Tenant context
 * • Request/correlation propagation
 * • Error cause preservation
 * • Safe serialization
 * • Operational diagnostics
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Logging
 * • Metrics
 * • Payment execution
 * • Provider communication
 *
 * ============================================================================
 */

const DEFAULT_STATUS_CODE = 500;

const ERROR_CATEGORIES = Object.freeze({

    VALIDATION:
        'VALIDATION',

    AUTHENTICATION:
        'AUTHENTICATION',

    AUTHORIZATION:
        'AUTHORIZATION',

    IDEMPOTENCY:
        'IDEMPOTENCY',

    CONFLICT:
        'CONFLICT',

    PROVIDER:
        'PROVIDER',

    NETWORK:
        'NETWORK',

    TIMEOUT:
        'TIMEOUT',

    RATE_LIMIT:
        'RATE_LIMIT',

    NOT_FOUND:
        'NOT_FOUND',

    CONFIGURATION:
        'CONFIGURATION',

    INTERNAL:
        'INTERNAL'

});


const RETRYABLE_CATEGORIES =
    new Set([

        ERROR_CATEGORIES.PROVIDER,

        ERROR_CATEGORIES.NETWORK,

        ERROR_CATEGORIES.TIMEOUT,

        ERROR_CATEGORIES.RATE_LIMIT

    ]);


const SENSITIVE_KEYS =
    new Set([

        'password',

        'passwd',

        'secret',

        'clientsecret',

        'client_secret',

        'accesstoken',

        'access_token',

        'refreshtoken',

        'refresh_token',

        'authorization',

        'cookie',

        'set-cookie',

        'apikey',

        'api_key',

        'privatekey',

        'private_key',

        'token'

    ]);


/**
 * ============================================================================
 * Normalize Category
 * ============================================================================
 */
function normalizeCategory(category) {

    if (!category) {

        return ERROR_CATEGORIES.INTERNAL;

    }

    return String(category)
        .trim()
        .toUpperCase();

}


/**
 * ============================================================================
 * Sanitize Metadata
 * ============================================================================
 *
 * Prevents credentials, OAuth tokens and other secrets from being exposed
 * through error serialization or structured logging.
 */
function sanitizeMetadata(metadata) {

    if (
        !metadata ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata)
    ) {

        return {};

    }


    const result = {};


    for (
        const [key, value]
        of Object.entries(metadata)
    ) {

        const normalizedKey =
            String(key)
                .replace(/[\s-]/g, '')
                .toLowerCase();


        if (
            SENSITIVE_KEYS.has(
                normalizedKey
            )
        ) {

            result[key] =
                '[REDACTED]';

            continue;

        }


        result[key] =
            value;

    }


    return result;

}


/**
 * ============================================================================
 * Payment Engine Error
 * ============================================================================
 */
class PaymentEngineError extends Error {

    constructor(

        code,

        message,

        metadata = {},

        options = {}

    ) {

        super(
            message || 'Payment engine error'
        );


        this.name =
            'PaymentEngineError';


        this.code =
            code ||
            'PAYMENT_ENGINE_ERROR';


        this.category =
            normalizeCategory(
                options.category
            );


        this.statusCode =
            Number.isInteger(
                options.statusCode
            )
                ? options.statusCode
                : DEFAULT_STATUS_CODE;


        this.retryable =
            typeof options.retryable === 'boolean'
                ? options.retryable
                : RETRYABLE_CATEGORIES.has(
                    this.category
                );


        this.provider =
            options.provider ||
            null;


        this.providerCode =
            options.providerCode ||
            null;


        this.tenantId =
            options.tenantId ||
            null;


        this.requestId =
            options.requestId ||
            null;


        this.correlationId =
            options.correlationId ||
            null;


        this.operation =
            options.operation ||
            null;


        this.metadata =
            sanitizeMetadata(
                metadata
            );


        this.timestamp =
            new Date();


        /**
         * Preserve the original error when wrapping
         * lower-level failures.
         */
        if (options.cause) {

            this.cause =
                options.cause;

        }


        /**
         * Maintain native Error stack semantics.
         */
        if (Error.captureStackTrace) {

            Error.captureStackTrace(
                this,
                PaymentEngineError
            );

        }

    }


    /**
     * ------------------------------------------------------------------------
     * Retry Classification
     * ------------------------------------------------------------------------
     */
    isRetryable() {

        return this.retryable === true;

    }


    /**
     * ------------------------------------------------------------------------
     * Safe Serialization
     * ------------------------------------------------------------------------
     */
    toJSON() {

        return {

            name:
                this.name,

            code:
                this.code,

            category:
                this.category,

            message:
                this.message,

            statusCode:
                this.statusCode,

            retryable:
                this.retryable,

            provider:
                this.provider,

            providerCode:
                this.providerCode,

            tenantId:
                this.tenantId,

            requestId:
                this.requestId,

            correlationId:
                this.correlationId,

            operation:
                this.operation,

            metadata:
                {
                    ...this.metadata
                },

            timestamp:
                this.timestamp,

            cause:
                this.cause
                    ? {

                        name:
                            this.cause.name,

                        message:
                            this.cause.message,

                        code:
                            this.cause.code

                    }
                    : undefined

        };

    }


    /**
     * ------------------------------------------------------------------------
     * Operational Representation
     * ------------------------------------------------------------------------
     *
     * Deliberately excludes stack traces and arbitrary metadata.
     */
    toOperationalError() {

        return {

            code:
                this.code,

            category:
                this.category,

            message:
                this.message,

            statusCode:
                this.statusCode,

            retryable:
                this.retryable,

            provider:
                this.provider,

            providerCode:
                this.providerCode,

            tenantId:
                this.tenantId,

            requestId:
                this.requestId,

            correlationId:
                this.correlationId,

            operation:
                this.operation

        };

    }


    /**
     * ------------------------------------------------------------------------
     * Wrap Existing Error
     * ------------------------------------------------------------------------
     */
    static from(
        error,
        options = {}
    ) {

        if (
            error instanceof PaymentEngineError
        ) {

            return error;

        }


        return new PaymentEngineError(

            options.code ||
            error?.code ||
            'PAYMENT_ENGINE_ERROR',

            options.message ||
            error?.message ||
            'Payment engine error',

            options.metadata ||
            {},

            {

                ...options,

                cause:
                    error

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Validation Error
     * ------------------------------------------------------------------------
     */
    static validation(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.VALIDATION,

                statusCode:
                    options.statusCode || 400,

                retryable:
                    false

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Authentication Error
     * ------------------------------------------------------------------------
     */
    static authentication(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.AUTHENTICATION,

                statusCode:
                    options.statusCode || 401,

                retryable:
                    false

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Authorization Error
     * ------------------------------------------------------------------------
     */
    static authorization(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.AUTHORIZATION,

                statusCode:
                    options.statusCode || 403,

                retryable:
                    false

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Conflict / Idempotency Error
     * ------------------------------------------------------------------------
     */
    static conflict(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    options.category ||
                    ERROR_CATEGORIES.CONFLICT,

                statusCode:
                    options.statusCode || 409,

                retryable:
                    false

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Provider Error
     * ------------------------------------------------------------------------
     */
    static provider(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.PROVIDER,

                statusCode:
                    options.statusCode || 502

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Network Error
     * ------------------------------------------------------------------------
     */
    static network(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.NETWORK,

                statusCode:
                    options.statusCode || 502

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Timeout Error
     * ------------------------------------------------------------------------
     */
    static timeout(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.TIMEOUT,

                statusCode:
                    options.statusCode || 504,

                retryable:
                    options.retryable !== undefined
                        ? options.retryable
                        : true

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Rate Limit Error
     * ------------------------------------------------------------------------
     */
    static rateLimit(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.RATE_LIMIT,

                statusCode:
                    options.statusCode || 429,

                retryable:
                    options.retryable !== undefined
                        ? options.retryable
                        : true

            }

        );

    }


    /**
     * ------------------------------------------------------------------------
     * Internal Error
     * ------------------------------------------------------------------------
     */
    static internal(
        code,
        message,
        metadata = {},
        options = {}
    ) {

        return new PaymentEngineError(

            code,

            message,

            metadata,

            {

                ...options,

                category:
                    ERROR_CATEGORIES.INTERNAL,

                statusCode:
                    options.statusCode || 500,

                retryable:
                    options.retryable !== undefined
                        ? options.retryable
                        : false

            }

        );

    }

}


module.exports =
    PaymentEngineError;


/**
 * Named exports preserve compatibility with consumers that
 * prefer destructuring.
 */
module.exports.PaymentEngineError =
    PaymentEngineError;


module.exports.ERROR_CATEGORIES =
    ERROR_CATEGORIES;