'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * MTN MoMo Callback Normalizer
 * ============================================================================
 *
 * Converts provider-specific callback payloads into one canonical internal
 * representation.
 *
 * No ledger operations occur here.
 * No balance mutations occur here.
 * No accounting occurs here.
 *
 * ============================================================================
 */

const {
  MTNCallbackValidationError,
} = require('./mtnCallbackErrors');

const STATUS = Object.freeze({
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  UNKNOWN: 'UNKNOWN',
});

class MTNCallbackNormalizer {
  constructor(options = {}) {
    this.provider =
      options.provider ||
      'MTN_MOMO';
  }

  normalize(
    payload = {},
    context = {}
  ) {
    if (
      !payload ||
      typeof payload !== 'object'
    ) {
      throw new MTNCallbackValidationError(
        'MTN callback payload must be an object.',
        {
          code:
            'MTN_CALLBACK_PAYLOAD_INVALID',
        }
      );
    }

    const providerReference =
      this.firstDefined(
        payload.referenceId,
        payload.referenceID,
        payload.reference,
        payload['X-Reference-Id'],
        context.reference,
        context.providerReference
      );

    const externalId =
      this.firstDefined(
        payload.externalId,
        payload.externalID,
        payload.external_id,
        payload.transactionId,
        payload.transactionID
      );

    const providerStatus =
      this.firstDefined(
        payload.status,
        payload.transactionStatus,
        payload.financialTransactionStatus,
        payload.result
      );

    const normalizedStatus =
      this.normalizeStatus(
        providerStatus
      );

    const amount =
      this.toNumber(
        this.firstDefined(
          payload.amount,
          payload.amountValue
        )
      );

    const currency =
      this.firstDefined(
        payload.currency,
        payload.currencyCode
      ) || 'UGX';

    const callbackId =
      this.firstDefined(
        payload.callbackId,
        payload.callbackID,
        payload.eventId,
        payload.eventID,
        context.callbackId
      ) ||
      this.generateCallbackId(
        {
          providerReference,
          externalId,
          providerStatus,
          payload,
        }
      );

    const normalized = {
      callbackId,

      provider:
        this.provider,

      providerReference:
        providerReference || null,

      externalId:
        externalId || null,

      reference:
        externalId ||
        providerReference ||
        null,

      status:
        normalizedStatus,

      providerStatus:
        providerStatus || null,

      amount,

      currency,

      phoneNumber:
        this.firstDefined(
          payload.phoneNumber,
          payload.msisdn,
          payload.payer?.partyId,
          payload.payee?.partyId
        ) || null,

      transactionType:
        this.firstDefined(
          payload.transactionType,
          payload.type,
          context.transactionType
        ) || null,

      tenantId:
        this.firstDefined(
          payload.tenantId,
          context.tenantId
        ) || null,

      customerId:
        this.firstDefined(
          payload.customerId,
          context.customerId
        ) || null,

      loanId:
        this.firstDefined(
          payload.loanId,
          context.loanId
        ) || null,

      savingsAccountId:
        this.firstDefined(
          payload.savingsAccountId,
          context.savingsAccountId
        ) || null,

      reason:
        this.firstDefined(
          payload.reason,
          payload.message,
          payload.financialTransactionStatus
        ) || null,

      timestamp:
        this.parseTimestamp(
          this.firstDefined(
            payload.timestamp,
            payload.createdAt,
            payload.updatedAt
          )
        ),

      receivedAt:
        new Date(),

      rawPayload:
        payload,

      context: {
        requestId:
          context.requestId ||
          null,

        correlationId:
          context.correlationId ||
          null,

        signature:
          context.signature ||
          null,
      },
    };

    return normalized;
  }

  normalizeStatus(status) {
    const normalized =
      String(
        status || ''
      )
        .trim()
        .toUpperCase();

    if (
      [
        'SUCCESS',
        'SUCCESSFUL',
        'COMPLETED',
        'COMPLETE',
        'SUCCESSFULL',
      ].includes(normalized)
    ) {
      return STATUS.SUCCESSFUL;
    }

    if (
      [
        'FAILED',
        'FAILURE',
        'REJECTED',
        'CANCELLED',
        'CANCELED',
      ].includes(normalized)
    ) {
      return STATUS.FAILED;
    }

    if (
      [
        'PENDING',
        'PROCESSING',
        'IN_PROGRESS',
      ].includes(normalized)
    ) {
      return STATUS.PENDING;
    }

    return STATUS.UNKNOWN;
  }

  firstDefined(...values) {
    return values.find(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== ''
    );
  }

  toNumber(value) {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  parseTimestamp(value) {
    if (!value) {
      return null;
    }

    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  generateCallbackId(data) {
    const crypto =
      require('crypto');

    return crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          provider:
            this.provider,

          providerReference:
            data.providerReference ||
            null,

          externalId:
            data.externalId ||
            null,

          providerStatus:
            data.providerStatus ||
            null,

          payload:
            data.payload,
        })
      )
      .digest('hex');
  }
}

MTNCallbackNormalizer.STATUS =
  STATUS;

module.exports =
  MTNCallbackNormalizer;