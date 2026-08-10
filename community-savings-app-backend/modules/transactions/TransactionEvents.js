'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Events
 * ============================================================================
 *
 * Defines transaction domain events used across the financial platform.
 *
 * Supports:
 *
 *  - Transaction lifecycle events
 *  - Ledger integration events
 *  - Payment events
 *  - Settlement events
 *  - Recovery events
 *  - Compensation events
 *  - Audit events
 *
 * Designed for:
 *
 *  - Transactional Outbox Pattern
 *  - Event-driven architecture
 *  - Distributed systems
 *
 * ============================================================================
 */


const crypto = require('crypto');



const EVENT_VERSION = '1.0';



/**
 * ============================================================================
 * Transaction Event Types
 * ============================================================================
 */


const TransactionEventTypes = Object.freeze({


    /**
     * Transaction lifecycle
     */


    TRANSACTION_CREATED:

        'transaction.created',



    TRANSACTION_VALIDATED:

        'transaction.validated',



    TRANSACTION_STARTED:

        'transaction.started',



    TRANSACTION_PROCESSING:

        'transaction.processing',



    TRANSACTION_COMPLETED:

        'transaction.completed',



    TRANSACTION_FAILED:

        'transaction.failed',



    TRANSACTION_CANCELLED:

        'transaction.cancelled',



    TRANSACTION_TIMEOUT:

        'transaction.timeout',



    TRANSACTION_RETRYING:

        'transaction.retrying',



    TRANSACTION_RECOVERED:

        'transaction.recovered',



    TRANSACTION_ROLLED_BACK:

        'transaction.rollback.completed',




    /**
     * Financial events
     */


    LEDGER_POSTING_STARTED:

        'ledger.posting.started',



    LEDGER_POSTED:

        'ledger.posted',



    LEDGER_REVERSAL_CREATED:

        'ledger.reversal.created',



    BALANCE_UPDATED:

        'balance.updated',




    /**
     * Payment events
     */


    PAYMENT_INITIATED:

        'payment.initiated',



    PAYMENT_AUTHORIZED:

        'payment.authorized',



    PAYMENT_COMPLETED:

        'payment.completed',



    PAYMENT_FAILED:

        'payment.failed',



    PAYMENT_REVERSED:

        'payment.reversed',




    /**
     * Provider callbacks
     */


    PAYMENT_CALLBACK_RECEIVED:

        'payment.callback.received',



    PAYMENT_CALLBACK_PROCESSED:

        'payment.callback.processed',



    PAYMENT_CALLBACK_FAILED:

        'payment.callback.failed',




    /**
     * Settlement
     */


    SETTLEMENT_STARTED:

        'settlement.started',



    SETTLEMENT_COMPLETED:

        'settlement.completed',



    SETTLEMENT_FAILED:

        'settlement.failed',




    /**
     * Recovery
     */


    COMPENSATION_STARTED:

        'compensation.started',



    COMPENSATION_COMPLETED:

        'compensation.completed',



    COMPENSATION_FAILED:

        'compensation.failed',




    /**
     * Audit
     */


    AUDIT_REQUIRED:

        'audit.required'


});



/**
 * ============================================================================
 * Event Categories
 * ============================================================================
 */


const EventCategories = Object.freeze({


    TRANSACTION:

        'transaction',



    FINANCIAL:

        'financial',



    PAYMENT:

        'payment',



    SETTLEMENT:

        'settlement',



    RECOVERY:

        'recovery',



    AUDIT:

        'audit'


});



/**
 * ============================================================================
 * Transaction Events Factory
 * ============================================================================
 */


class TransactionEvents {


    constructor(options = {}) {


        this.serviceName =

            options.serviceName ||

            'transaction-service';



        this.version =

            options.version ||

            EVENT_VERSION;


    }



    /**
     * =========================================================================
     * Create Event
     * =========================================================================
     */


    create(type, payload = {}, context = {}) {


        if (

            !type

        ) {


            throw new Error(

                'Event type required'

            );


        }



        return {


            eventId:

                crypto.randomUUID(),



            eventType:

                type,



            eventVersion:

                this.version,



            category:

                this.resolveCategory(

                    type

                ),



            occurredAt:

                new Date(),



            source:

                this.serviceName,



            transactionId:

                context.transactionId || null,



            tenantId:

                context.tenantId || null,



            correlationId:

                context.correlationId || null,



            requestId:

                context.requestId || null,



            traceId:

                context.traceId || null,



            payload,


            metadata: {


                environment:

                    process.env.NODE_ENV ||


                    'development'


            }


        };


    }



    /**
     * =========================================================================
     * Transaction Created
     * =========================================================================
     */


    transactionCreated(transaction, context) {


        return this.create(

            TransactionEventTypes.TRANSACTION_CREATED,

            transaction,

            context

        );


    }



    /**
     * =========================================================================
     * Transaction Completed
     * =========================================================================
     */


    transactionCompleted(transaction, context) {


        return this.create(

            TransactionEventTypes.TRANSACTION_COMPLETED,

            transaction,

            context

        );


    }



    /**
     * =========================================================================
     * Transaction Failed
     * =========================================================================
     */


    transactionFailed(transaction, error, context) {


        return this.create(

            TransactionEventTypes.TRANSACTION_FAILED,

            {

                transaction,


                error:

                    this.normalizeError(error)

            },

            context

        );


    }



    /**
     * =========================================================================
     * Ledger Posted
     * =========================================================================
     */


    ledgerPosted(entry, context) {


        return this.create(

            TransactionEventTypes.LEDGER_POSTED,

            entry,

            context

        );


    }



    /**
     * =========================================================================
     * Payment Completed
     * =========================================================================
     */


    paymentCompleted(payment, context) {


        return this.create(

            TransactionEventTypes.PAYMENT_COMPLETED,

            payment,

            context

        );


    }



    /**
     * =========================================================================
     * Rollback Completed
     * =========================================================================
     */


    rollbackCompleted(data, context) {


        return this.create(

            TransactionEventTypes.TRANSACTION_ROLLED_BACK,

            data,

            context

        );


    }



    /**
     * =========================================================================
     * Compensation Event
     * =========================================================================
     */


    compensationCompleted(data, context) {


        return this.create(

            TransactionEventTypes.COMPENSATION_COMPLETED,

            data,

            context

        );


    }



    /**
     * =========================================================================
     * Error Normalizer
     * =========================================================================
     */


    normalizeError(error) {


        if (!error) {


            return null;


        }



        return {


            name:

                error.name,



            message:

                error.message,



            code:

                error.code || null


        };


    }



    /**
     * =========================================================================
     * Category Resolver
     * =========================================================================
     */


    resolveCategory(type) {


        if (

            type.startsWith(

                'ledger.'

            )

        ) {


            return EventCategories.FINANCIAL;


        }



        if (

            type.startsWith(

                'payment.'

            )

        ) {


            return EventCategories.PAYMENT;


        }



        if (

            type.startsWith(

                'settlement.'

            )

        ) {


            return EventCategories.SETTLEMENT;


        }



        if (

            type.startsWith(

                'compensation.'

            )

            ||

            type.startsWith(

                'transaction.rollback'

            )

        ) {


            return EventCategories.RECOVERY;


        }



        if (

            type.startsWith(

                'audit.'

            )

        ) {


            return EventCategories.AUDIT;


        }



        return EventCategories.TRANSACTION;


    }



    /**
     * =========================================================================
     * Serialize Event
     * =========================================================================
     */


    serialize(event) {


        return JSON.stringify(

            event

        );


    }



    /**
     * =========================================================================
     * Validate Event
     * =========================================================================
     */


    validate(event) {


        return Boolean(

            event &&

            event.eventId &&

            event.eventType &&

            event.payload

        );


    }



}



TransactionEvents.Types =
    TransactionEventTypes;



TransactionEvents.Categories =
    EventCategories;



module.exports = TransactionEvents;