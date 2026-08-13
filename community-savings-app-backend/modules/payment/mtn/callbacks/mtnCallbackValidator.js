'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * MTN MoMo Callback Validator
 * ============================================================================
 *
 * Validation is intentionally separate from normalization.
 *
 * Responsibilities:
 *
 *   - required references
 *   - status validation
 *   - amount validation
 *   - provider consistency
 *   - reference correlation
 *
 * ============================================================================
 */

const {
  MTNCallbackValidationError,
} = require('./mtnCallbackErrors');

class MTNCallbackValidator {
  constructor(options = {}) {
    this.provider =
      options.provider ||
      'MTN_MOMO';

    this.requireAmount =
      options.requireAmount !==
      undefined
        ? Boolean(
            options.requireAmount
          )
        : false;

    this.allowUnknownStatus =
      options.allowUnknownStatus !==
      undefined
        ? Boolean(
            options.allowUnknownStatus
          )
        : true;
  }

  validate(
    callback,
    context = {}
  ) {
    if (
      !callback ||
      typeof callback !== 'object'
    ) {
      throw new MTNCallbackValidationError(
        'Normalized callback is required.',
        {
          code:
            'MTN_NORMALIZED_CALLBACK_REQUIRED',
        }
      );
    }

    const errors = [];

    if (
      callback.provider !==
      this.provider
    ) {
      errors.push(
        `Unexpected provider: ${callback.provider}`
      );
    }

    if (
      !callback.callbackId
    ) {
      errors.push(
        'callbackId is required'
      );
    }

    if (
      !callback.reference &&
      !callback.providerReference
    ) {
      errors.push(
        'transaction reference is required'
      );
    }

    if (
      !callback.status
    ) {
      errors.push(
        'callback status is required'
      );
    }

    if (
      !this.allowUnknownStatus &&
      callback.status ===
        'UNKNOWN'
    ) {
      errors.push(
        'unknown provider status is not allowed'
      );
    }

    if (
      this.requireAmount &&
      (
        callback.amount === null ||
        callback.amount === undefined ||
        callback.amount <= 0
      )
    ) {
      errors.push(
        'valid transaction amount is required'
      );
    }

    if (
      callback.amount !== null &&
      callback.amount !== undefined &&
      (
        !Number.isFinite(
          callback.amount
        ) ||
        callback.amount < 0
      )
    ) {
      errors.push(
        'amount must be a valid non-negative number'
      );
    }

    if (
      errors.length
    ) {
      throw new MTNCallbackValidationError(
        errors.join('; '),
        {
          code:
            'MTN_CALLBACK_VALIDATION_FAILED',

          reference:
            callback.reference ||
            callback.providerReference,

          providerReference:
            callback.providerReference,

          callbackId:
            callback.callbackId,
        }
      );
    }

    return true;
  }

  validateReferenceCorrelation(
    callback,
    transaction
  ) {
    if (!transaction) {
      throw new MTNCallbackValidationError(
        'Callback transaction could not be correlated.',
        {
          code:
            'MTN_CALLBACK_TRANSACTION_NOT_FOUND',

          reference:
            callback.reference ||
            callback.providerReference,

          providerReference:
            callback.providerReference,

          callbackId:
            callback.callbackId,
        }
      );
    }

    if (
      callback.providerReference &&
      transaction.providerReference &&
      String(
        callback.providerReference
      ) !==
        String(
          transaction.providerReference
        )
    ) {
      throw new MTNCallbackValidationError(
        'Provider reference does not match the persisted transaction.',
        {
          code:
            'MTN_CALLBACK_PROVIDER_REFERENCE_MISMATCH',

          reference:
            callback.reference,

          providerReference:
            callback.providerReference,

          callbackId:
            callback.callbackId,
        }
      );
    }

    return true;
  }
}

module.exports =
  MTNCallbackValidator;