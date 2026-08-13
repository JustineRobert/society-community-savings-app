'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * MTN Callback Idempotency
 * ============================================================================
 *
 * Durable idempotency adapter.
 *
 * The implementation supports an existing model/service when supplied,
 * while maintaining a bounded in-process fallback.
 *
 * Production deployments should provide a persistent implementation.
 *
 * ============================================================================
 */

const crypto =
  require('crypto');

class MTNCallbackIdempotency {
  constructor(options = {}) {
    this.model =
      options.model ||
      null;

    this.cache =
      options.cache ||
      new Map();

    this.ttlMs =
      Number(
        options.ttlMs ||
          24 * 60 * 60 * 1000
      );
  }

  createKey(callback) {
    if (
      callback.callbackId
    ) {
      return `MTN_MOMO:CALLBACK:${callback.callbackId}`;
    }

    return (
      'MTN_MOMO:CALLBACK:' +
      crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            providerReference:
              callback.providerReference,

            reference:
              callback.reference,

            status:
              callback.status,
          })
        )
        .digest('hex')
    );
  }

  async check(
    callback
  ) {
    const key =
      this.createKey(
        callback
      );

    if (this.model) {
      try {
        const existing =
          await this.model
            .findOne({
              idempotencyKey:
                key,
            })
            .lean?.();

        if (existing) {
          return {
            duplicate: true,
            key,
            record: existing,
          };
        }
      } catch {
        /**
         * Persistent lookup failure must not silently turn into a successful
         * duplicate check.
         *
         * The processor can choose whether persistence is mandatory.
         */
      }
    }

    const cached =
      this.cache.get(key);

    if (cached) {
      return {
        duplicate: true,
        key,
        record: cached,
      };
    }

    return {
      duplicate: false,
      key,
    };
  }

  async reserve(
    callback,
    metadata = {}
  ) {
    const key =
      this.createKey(
        callback
      );

    const existing =
      await this.check(
        callback
      );

    if (
      existing.duplicate
    ) {
      return existing;
    }

    const record = {
      idempotencyKey:
        key,

      callbackId:
        callback.callbackId,

      reference:
        callback.reference,

      providerReference:
        callback.providerReference,

      status:
        callback.status,

      state:
        'PROCESSING',

      createdAt:
        new Date(),

      updatedAt:
        new Date(),

      ...metadata,
    };

    if (this.model) {
      try {
        const created =
          await this.model.create(
            record
          );

        return {
          duplicate: false,
          key,
          record: created,
        };
      } catch (error) {
        /**
         * Unique-index collisions are interpreted as duplicates.
         */
        if (
          error?.code ===
            11000
        ) {
          return {
            duplicate: true,
            key,
          };
        }

        throw error;
      }
    }

    this.cache.set(
      key,
      record
    );

    const timer =
      setTimeout(
        () => {
          this.cache.delete(
            key
          );
        },
        this.ttlMs
      );

    timer.unref?.();

    return {
      duplicate: false,
      key,
      record,
    };
  }

  async complete(
    callback,
    data = {}
  ) {
    const key =
      this.createKey(
        callback
      );

    if (this.model) {
      return this.model.updateOne(
        {
          idempotencyKey:
            key,
        },
        {
          $set: {
            state:
              'COMPLETED',

            updatedAt:
              new Date(),

            ...data,
          },
        }
      );
    }

    const record =
      this.cache.get(
        key
      );

    if (record) {
      this.cache.set(
        key,
        {
          ...record,
          state:
            'COMPLETED',
          updatedAt:
            new Date(),
          ...data,
        }
      );
    }

    return true;
  }

  async fail(
    callback,
    data = {}
  ) {
    const key =
      this.createKey(
        callback
      );

    if (this.model) {
      return this.model.updateOne(
        {
          idempotencyKey:
            key,
        },
        {
          $set: {
            state:
              'FAILED',

            updatedAt:
              new Date(),

            ...data,
          },
        }
      );
    }

    const record =
      this.cache.get(
        key
      );

    if (record) {
      this.cache.set(
        key,
        {
          ...record,
          state:
            'FAILED',
          updatedAt:
            new Date(),
          ...data,
        }
      );
    }

    return true;
  }
}

module.exports =
  MTNCallbackIdempotency;