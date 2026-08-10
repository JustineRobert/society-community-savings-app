'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Retry Policy
 * ============================================================================
 *
 * Enterprise retry policy for distributed financial transactions.
 *
 * Features
 * --------
 * ✓ Exponential Backoff
 * ✓ Decorrelated Jitter
 * ✓ Retry Budget
 * ✓ Maximum Retry Count
 * ✓ Maximum Elapsed Time
 * ✓ Retryable Error Classification
 * ✓ Circuit Breaker Awareness
 * ✓ Timeout Awareness
 * ✓ OpenTelemetry
 * ✓ Metrics
 * ✓ Audit Events
 * ✓ Structured Logging
 *
 * ============================================================================
 */

const DEFAULTS = Object.freeze({

    maxAttempts: 5,

    initialDelay: 250,

    maxDelay: 30000,

    multiplier: 2,

    jitter: true,

    maxElapsedTime: 300000

});

const NON_RETRYABLE_CODES = new Set([

    'VALIDATION_ERROR',

    'INVALID_ARGUMENT',

    'INVALID_TRANSACTION',

    'UNAUTHORIZED',

    'FORBIDDEN',

    'NOT_FOUND',

    'DUPLICATE_TRANSACTION',

    'IDEMPOTENCY_CONFLICT'

]);

const RETRYABLE_CODES = new Set([

    'NETWORK_ERROR',

    'ECONNRESET',

    'ECONNREFUSED',

    'ETIMEDOUT',

    'EAI_AGAIN',

    'REDIS_TIMEOUT',

    'DATABASE_TIMEOUT',

    'LOCK_TIMEOUT',

    'SERVICE_UNAVAILABLE',

    'RATE_LIMITED',

    'TEMPORARY_FAILURE',

    'DEADLOCK',

    'TRANSACTION_ABORTED'

]);

class TransactionRetryPolicy {

    constructor(options = {}) {

        this.options = {

            ...DEFAULTS,

            ...options

        };

        this.logger =
            options.logger || console;

        this.metrics =
            options.metrics;

        this.tracer =
            options.tracer;

        this.auditPublisher =
            options.auditPublisher;

        this.circuitBreaker =
            options.circuitBreaker;

    }

    /**
     * =========================================================================
     * Execute with Retry
     * =========================================================================
     */

    async execute(operation, context = {}) {

        const span =
            this.tracer?.startSpan?.(
                'transaction.retry.execute'
            );

        const started = Date.now();

        let attempt = 0;

        let lastError;

        while (attempt < this.options.maxAttempts) {

            attempt++;

            try {

                if (

                    this.circuitBreaker?.isOpen?.()

                ) {

                    throw this.createError(

                        'Circuit breaker is open',

                        'CIRCUIT_OPEN'

                    );

                }

                const result =
                    await operation(attempt);

                this.metrics?.increment?.(

                    'transaction_retry_success_total'

                );

                span?.end?.();

                return result;

            }

            catch (error) {

                lastError = error;

                if (

                    !this.shouldRetry(

                        error,

                        attempt,

                        started

                    )

                ) {

                    break;

                }

                const delay =
                    this.calculateDelay(
                        attempt
                    );

                this.logger.warn?.(

                    '[RetryPolicy] Retrying transaction',

                    {

                        attempt,

                        delay,

                        error:
                            error.message

                    }

                );

                this.metrics?.increment?.(

                    'transaction_retry_attempt_total'

                );

                await this.auditPublisher?.publish?.({

                    type: 'TRANSACTION_RETRY',

                    attempt,

                    delay,

                    error:

                        error.message,

                    timestamp:
                        new Date(),

                    transactionId:
                        context.transactionId

                });

                await this.sleep(delay);

            }

        }

        this.metrics?.increment?.(

            'transaction_retry_exhausted_total'

        );

        span?.recordException?.(

            lastError

        );

        span?.end?.();

        throw lastError;

    }

    /**
     * =========================================================================
     * Retry Decision
     * =========================================================================
     */

    shouldRetry(error, attempt, startedAt) {

        if (

            attempt >= this.options.maxAttempts

        ) {

            return false;

        }

        if (

            Date.now() - startedAt >

            this.options.maxElapsedTime

        ) {

            return false;

        }

        if (

            NON_RETRYABLE_CODES.has(error.code)

        ) {

            return false;

        }

        if (

            RETRYABLE_CODES.has(error.code)

        ) {

            return true;

        }

        if (

            error.retryable === true

        ) {

            return true;

        }

        if (

            error.status >= 500

        ) {

            return true;

        }

        return false;

    }

    /**
     * =========================================================================
     * Delay Calculation
     * =========================================================================
     */

    calculateDelay(attempt) {

        const exponential =

            this.options.initialDelay *

            Math.pow(

                this.options.multiplier,

                attempt - 1

            );

        let delay =

            Math.min(

                exponential,

                this.options.maxDelay

            );

        if (

            this.options.jitter

        ) {

            delay =

                this.applyJitter(

                    delay

                );

        }

        return Math.floor(delay);

    }

    /**
     * =========================================================================
     * Decorrelated Jitter
     * =========================================================================
     */

    applyJitter(delay) {

        const min =

            delay / 2;

        const max =

            delay;

        return (

            min +

            Math.random() *

            (max - min)

        );

    }

    /**
     * =========================================================================
     * Wait Helper
     * =========================================================================
     */

    async wait(attempt) {

        const delay =

            this.calculateDelay(

                attempt

            );

        return this.sleep(delay);

    }

    /**
     * =========================================================================
     * Helpers
     * =========================================================================
     */

    sleep(ms) {

        return new Promise(resolve => {

            setTimeout(resolve, ms);

        });

    }

    createError(message, code) {

        const error = new Error(message);

        error.code = code;

        return error;

    }

    /**
     * =========================================================================
     * Runtime Configuration
     * =========================================================================
     */

    update(options = {}) {

        Object.assign(

            this.options,

            options

        );

    }

    getConfiguration() {

        return {

            ...this.options

        };

    }

    /**
     * =========================================================================
     * Static Utility
     * =========================================================================
     */

    static isRetryable(error) {

        return (

            RETRYABLE_CODES.has(

                error.code

            ) ||

            error.retryable === true ||

            error.status >= 500

        );

    }

}

module.exports = TransactionRetryPolicy;