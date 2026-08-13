'use strict';
// backend/modules/payments/mtn/models/MTNCallback.js
const MTNCallback =
    require('./payments/mtn/models/MTNCallback');

this.callbackIdempotency =
    new MTNCallbackIdempotency({
        model:
            MTNCallback,

        cache:
            this.idempotencyCache,

        ttlMs:
            this.idempotencyTtlSeconds *
            1000,
    });

const mongoose =
    require('mongoose');

const MTNCallbackSchema =
    new mongoose.Schema(
        {
            provider: {
                type: String,
                required: true,
                index: true,
                immutable: true,
            },

            callbackId: {
                type: String,
                required: true,
                unique: true,
                index: true,
                immutable: true,
            },

            idempotencyKey: {
                type: String,
                required: true,
                unique: true,
                index: true,
                immutable: true,
            },

            reference: {
                type: String,
                index: true,
            },

            providerReference: {
                type: String,
                index: true,
            },

            status: {
                type: String,
                required: true,
                index: true,
            },

            state: {
                type: String,
                required: true,
                index: true,
            },

            attemptCount: {
                type: Number,
                default: 0,
            },

            amount: {
                type: Number,
            },

            currency: {
                type: String,
            },

            transactionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Transaction',
                index: true,
            },

            lastErrorCode: {
                type: String,
            },

            lastErrorMessage: {
                type: String,
            },

            firstReceivedAt: {
                type: Date,
            },

            lastProcessedAt: {
                type: Date,
            },

            completedAt: {
                type: Date,
            },

            deadLetteredAt: {
                type: Date,
            },

            payload: {
                type: mongoose.Schema.Types.Mixed,
            },

            metadata: {
                type: mongoose.Schema.Types.Mixed,
            },
        },
        {
            timestamps: true,
            versionKey: false,
        }
    );

MTNCallbackSchema.index({
    provider: 1,
    providerReference: 1,
});

MTNCallbackSchema.index({
    provider: 1,
    reference: 1,
});

MTNCallbackSchema.index({
    state: 1,
    createdAt: -1,
});

module.exports =
    mongoose.models.MTNCallback ||
    mongoose.model(
        'MTNCallback',
        MTNCallbackSchema
    );