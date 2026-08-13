'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * MTN MoMo Callback Errors
 * ============================================================================
 *
 * Shared error hierarchy for the MTN callback pipeline.
 *
 * Callback errors are intentionally distinct from MTNMomoError because the
 * callback subsystem has its own lifecycle:
 *
 *   RECEIVE
 *      ↓
 *   VALIDATE
 *      ↓
 *   IDEMPOTENCY
 *      ↓
 *   PROCESS
 *      ↓
 *   COMPLETE / RETRY / DLQ
 *
 * ============================================================================
 */

class MTNCallbackError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'MTNCallbackError';

    this.code =
      options.code ||
      'MTN_CALLBACK_ERROR';

    this.statusCode =
      options.statusCode ??
      null;

    this.reference =
      options.reference ??
      null;

    this.providerReference =
      options.providerReference ??
      null;

    this.callbackId =
      options.callbackId ??
      null;

    this.retryable =
      Boolean(options.retryable);

    this.dlq =
      Boolean(options.dlq);

    this.cause =
      options.cause;

    Error.captureStackTrace?.(
      this,
      MTNCallbackError
    );
  }
}

class MTNCallbackValidationError
  extends MTNCallbackError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code:
        options.code ||
        'MTN_CALLBACK_VALIDATION_ERROR',
      retryable: false,
      dlq: false,
    });

    this.name =
      'MTNCallbackValidationError';
  }
}

class MTNCallbackDuplicateError
  extends MTNCallbackError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code:
        options.code ||
        'MTN_CALLBACK_DUPLICATE',
      retryable: false,
      dlq: false,
    });

    this.name =
      'MTNCallbackDuplicateError';
  }
}

class MTNCallbackProcessingError
  extends MTNCallbackError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code:
        options.code ||
        'MTN_CALLBACK_PROCESSING_ERROR',
    });

    this.name =
      'MTNCallbackProcessingError';
  }
}

class MTNCallbackDeadLetterError
  extends MTNCallbackError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code:
        options.code ||
        'MTN_CALLBACK_DLQ_ERROR',
      retryable: false,
      dlq: true,
    });

    this.name =
      'MTNCallbackDeadLetterError';
  }
}

module.exports = {
  MTNCallbackError,
  MTNCallbackValidationError,
  MTNCallbackDuplicateError,
  MTNCallbackProcessingError,
  MTNCallbackDeadLetterError,
};