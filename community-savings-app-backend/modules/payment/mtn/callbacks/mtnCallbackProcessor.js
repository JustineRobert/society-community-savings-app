'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * MTN MoMo Callback Processor
 * ============================================================================
 *
 * Financial boundary:
 *
 * Callback Processor
 *       |
 *       +--> transaction state
 *       |
 *       +--> successful transaction handoff
 *       |
 *       +--> failed transaction handoff
 *       |
 *       +--> idempotency
 *       |
 *       +--> DLQ
 *
 * It does NOT implement ledger accounting itself.
 *
 * The existing mtnMomoService remains responsible for handing successful
 * transactions into the established financial lifecycle.
 *
 * ============================================================================
 */

const {
    MTNCallbackProcessingError,
} = require('./mtnCallbackErrors');

const CALLBACK_STATE = Object.freeze({
    RECEIVED: 'RECEIVED',
    VALIDATED: 'VALIDATED',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    RETRY_PENDING: 'RETRY_PENDING',
    DEAD_LETTERED: 'DEAD_LETTERED',
});

MTNCallbackProcessor.STATE =
    CALLBACK_STATE;

class MTNCallbackProcessor {
    constructor(options = {}) {
        this.logger =
            options.logger ||
            console;

        this.idempotency =
            options.idempotency ||
            null;

        this.deadLetter =
            options.deadLetter ||
            null;

        this.transactionResolver =
            options.transactionResolver ||
            null;

        this.stateHandler =
            options.stateHandler ||
            null;

        this.successHandler =
            options.successHandler ||
            null;

        this.failureHandler =
            options.failureHandler ||
            null;

        this.audit =
            options.audit ||
            null;

        this.maxAttempts =
            Number(
                options.maxAttempts ||
                5
            );
    }

    async process(
        callback,
        context = {}
    ) {
        if (!callback) {
            throw new MTNCallbackProcessingError(
                'Callback is required.',
                {
                    code:
                        'MTN_CALLBACK_REQUIRED',
                }
            );
        }

        let reservation = null;

        try {
            /**
             * --------------------------------------------------------------
             * IDEMPOTENCY RESERVATION
             * --------------------------------------------------------------
             */

            if (
                this.idempotency
            ) {
                reservation =
                    await this.idempotency.reserve(
                        callback,
                        {
                            attempt:
                                context.attempt ||
                                1,

                            requestId:
                                context.requestId ||
                                null,
                        }
                    );

                if (
                    reservation.duplicate
                ) {
                    await this.auditEvent(
                        'CALLBACK_DUPLICATE',
                        {
                            callback,
                        }
                    );

                    return {
                        success: true,
                        processed: false,
                        duplicate: true,
                        callbackId:
                            callback.callbackId,
                        reference:
                            callback.reference,
                        providerReference:
                            callback.providerReference,
                        status:
                            callback.status,
                    };
                }
            }

            /**
             * --------------------------------------------------------------
             * TRANSACTION CORRELATION
             * --------------------------------------------------------------
             */

            let transaction = null;

            if (
                this.transactionResolver
            ) {
                transaction =
                    await this.transactionResolver(
                        callback,
                        context
                    );
            }

            /**
             * --------------------------------------------------------------
             * STATE TRANSITION
             * --------------------------------------------------------------
             */

            if (
                this.stateHandler
            ) {
                await this.stateHandler(
                    callback,
                    transaction,
                    context
                );
            }

            /**
             * --------------------------------------------------------------
             * FINANCIAL HANDOFF
             * --------------------------------------------------------------
             */

            if (
                callback.status ===
                'SUCCESSFUL'
            ) {
                if (
                    this.successHandler
                ) {
                    await this.successHandler(
                        callback,
                        transaction,
                        context
                    );
                }
            }

            if (
                callback.status ===
                'FAILED'
            ) {
                if (
                    this.failureHandler
                ) {
                    await this.failureHandler(
                        callback,
                        transaction,
                        context
                    );
                }
            }

            /**
             * --------------------------------------------------------------
             * COMPLETE IDEMPOTENCY
             * --------------------------------------------------------------
             */

            if (
                this.idempotency
            ) {
                await this.idempotency.complete(
                    callback,
                    {
                        processedAt:
                            new Date(),

                        finalStatus:
                            callback.status,
                    }
                );
            }

            await this.auditEvent(
                'CALLBACK_PROCESSED',
                {
                    callback,
                    transactionId:
                        transaction?._id ||
                        transaction?.id ||
                        null,
                }
            );

            return {
                success: true,
                processed: true,
                duplicate: false,
                callbackId:
                    callback.callbackId,
                reference:
                    callback.reference,
                providerReference:
                    callback.providerReference,
                status:
                    callback.status,
            };
        } catch (error) {
            const normalized =
                error instanceof
                    MTNCallbackProcessingError
                    ? error
                    : new MTNCallbackProcessingError(
                        error?.message ||
                        'MTN callback processing failed.',
                        {
                            code:
                                error?.code ||
                                'MTN_CALLBACK_PROCESSING_FAILED',

                            reference:
                                callback.reference,

                            providerReference:
                                callback.providerReference,

                            callbackId:
                                callback.callbackId,

                            retryable:
                                error?.retryable !==
                                    undefined
                                    ? error.retryable
                                    : true,

                            cause:
                                error,
                        }
                    );

            if (
                this.idempotency
            ) {
                await this.idempotency.fail(
                    callback,
                    {
                        error:
                            normalized.message,

                        code:
                            normalized.code,
                    }
                );
            }

            await this.auditEvent(
                'CALLBACK_PROCESSING_FAILED',
                {
                    callback,
                    error: {
                        message:
                            normalized.message,

                        code:
                            normalized.code,

                        retryable:
                            normalized.retryable,
                    },
                }
            );

            /**
             * --------------------------------------------------------------
             * DLQ
             * --------------------------------------------------------------
             *
             * Only send to DLQ after retry exhaustion or when explicitly marked
             * non-retryable.
             */

            const attempt =
                Number(
                    context.attempt ||
                    1
                );

            const exhausted =
                attempt >=
                this.maxAttempts;

            if (
                this.deadLetter &&
                (
                    exhausted ||
                    !normalized.retryable
                )
            ) {
                await this.deadLetter.enqueue(
                    callback,
                    normalized,
                    {
                        attempt,
                        exhausted,
                    }
                );
            }

            throw normalized;
        }
    }

    async auditEvent(
        action,
        payload
    ) {
        try {
            if (
                typeof this.audit ===
                'function'
            ) {
                await this.audit(
                    action,
                    payload
                );
            }
        } catch (error) {
            this.logger.error?.(
                '[MTN_MOMO] callback audit failed',
                error
            );
        }
    }
}

module.exports =
    MTNCallbackProcessor;