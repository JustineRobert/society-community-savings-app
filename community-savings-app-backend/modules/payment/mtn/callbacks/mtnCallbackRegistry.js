'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * MTN Callback Registry
 * ============================================================================
 *
 * Registry responsibility:
 *
 *   provider
 *      ↓
 *   callback type
 *      ↓
 *   normalizer
 *      ↓
 *   validator
 *      ↓
 *   processor
 *
 * The registry deliberately does not process financial transactions.
 *
 * ============================================================================
 */

const {
  MTNCallbackError,
} = require('./mtnCallbackErrors');

class MTNCallbackRegistry {
  constructor(options = {}) {
    this.logger =
      options.logger ||
      console;

    this.providers =
      new Map();

    this.defaultProvider =
      options.defaultProvider ||
      'MTN_MOMO';
  }

  register(
    provider,
    definition = {}
  ) {
    if (!provider) {
      throw new MTNCallbackError(
        'Callback provider is required.',
        {
          code:
            'MTN_CALLBACK_PROVIDER_REQUIRED',
        }
      );
    }

    if (
      typeof definition.normalizer !==
      'function'
    ) {
      throw new MTNCallbackError(
        'Callback normalizer is required.',
        {
          code:
            'MTN_CALLBACK_NORMALIZER_REQUIRED',
        }
      );
    }

    if (
      typeof definition.validator !==
      'function'
    ) {
      throw new MTNCallbackError(
        'Callback validator is required.',
        {
          code:
            'MTN_CALLBACK_VALIDATOR_REQUIRED',
        }
      );
    }

    if (
      typeof definition.processor !==
      'function'
    ) {
      throw new MTNCallbackError(
        'Callback processor is required.',
        {
          code:
            'MTN_CALLBACK_PROCESSOR_REQUIRED',
        }
      );
    }

    this.providers.set(
      String(provider).toUpperCase(),
      {
        provider:
          String(provider).toUpperCase(),

        normalizer:
          definition.normalizer,

        validator:
          definition.validator,

        processor:
          definition.processor,

        idempotency:
          definition.idempotency ||
          null,

        deadLetter:
          definition.deadLetter ||
          null,

        metadata:
          definition.metadata ||
          {},
      }
    );

    return this;
  }

  unregister(provider) {
    return this.providers.delete(
      String(provider).toUpperCase()
    );
  }

  get(provider) {
    return this.providers.get(
      String(provider).toUpperCase()
    );
  }

  has(provider) {
    return this.providers.has(
      String(provider).toUpperCase()
    );
  }

  resolve(provider) {
    const normalizedProvider =
      String(
        provider ||
          this.defaultProvider
      ).toUpperCase();

    const definition =
      this.providers.get(
        normalizedProvider
      );

    if (!definition) {
      throw new MTNCallbackError(
        `No callback handler registered for provider ${normalizedProvider}.`,
        {
          code:
            'MTN_CALLBACK_PROVIDER_NOT_REGISTERED',
        }
      );
    }

    return definition;
  }

  list() {
    return Array.from(
      this.providers.keys()
    );
  }
}

module.exports =
  MTNCallbackRegistry;