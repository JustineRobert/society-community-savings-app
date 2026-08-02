'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Payment Event Publisher
 * =============================================================================
 *
 * Central event publishing service for payment workflows.
 *
 * Responsible for:
 *
 * ✓ Publishing payment lifecycle events
 * ✓ Standardizing event envelopes
 * ✓ Correlation propagation
 * ✓ Tenant context propagation
 * ✓ Audit integration
 * ✓ Event bus abstraction
 * ✓ Async workflow triggering
 *
 *
 * Used by:
 *
 * • Payment Orchestrator
 * • MTN MoMo Adapter
 * • Airtel Money Adapter
 * • Callback Engine
 * • Settlement Engine
 * • Reconciliation Engine
 * • Ledger Integration
 * • Notification Service
 * • Fraud Engine
 *
 *
 * Does NOT:
 *
 * ✗ Execute payments
 * ✗ Update database state directly
 * ✗ Perform retries
 * ✗ Own business rules
 *
 * =============================================================================
 */



const crypto = require('crypto');








/**
 * =============================================================================
 * Payment Event Types
 * =============================================================================
 */


const PAYMENT_EVENTS = Object.freeze({



    PAYMENT_CREATED:

        'payment.created',



    PAYMENT_SUBMITTED:

        'payment.submitted',



    PAYMENT_PROCESSING:

        'payment.processing',



    PAYMENT_SUCCESSFUL:

        'payment.successful',



    PAYMENT_FAILED:

        'payment.failed',



    PAYMENT_REVERSED:

        'payment.reversed',



    PAYMENT_CANCELLED:

        'payment.cancelled',



    PAYMENT_CALLBACK_RECEIVED:

        'payment.callback.received',



    PAYMENT_CALLBACK_FAILED:

        'payment.callback.failed',



    PAYMENT_SETTLEMENT_CREATED:

        'payment.settlement.created',



    PAYMENT_SETTLEMENT_COMPLETED:

        'payment.settlement.completed',



    PAYMENT_RECONCILIATION_COMPLETED:

        'payment.reconciliation.completed',



    PAYMENT_RECONCILIATION_FAILED:

        'payment.reconciliation.failed',



    PAYMENT_LEDGER_POSTED:

        'payment.ledger.posted'


});









/**
 * =============================================================================
 * Payment Event Publisher
 * =============================================================================
 */


class PaymentEventPublisher {



    constructor({

        eventBus,

        auditService,

        logger,

        metrics,

        tracer

    } = {}) {



        this.eventBus = eventBus;

        this.auditService = auditService;

        this.logger = logger;

        this.metrics = metrics;

        this.tracer = tracer;


    }








    /**
     * =========================================================================
     * Publish Generic Payment Event
     * =========================================================================
     */


    async publish({

        type,

        payload = {},

        tenantId = null,

        correlationId = null,

        transactionId = null,

        provider = null,

        metadata = {}

    } = {}) {



        if (!type) {



            throw new Error(

                'Payment event type required'

            );


        }







        const event = {



            id:

                crypto.randomUUID(),



            type,



            version:

                '1.0',



            source:

                'titech-payment-engine',



            timestamp:

                new Date(),



            tenantId,



            transactionId,



            provider,



            correlationId:

                correlationId ||

                crypto.randomUUID(),



            payload,



            metadata



        };








        const span =

            this.tracer?.startSpan?.(

                'payment.event.publish'

            );








        try {



            await this.eventBus.publish(

                event

            );








            await this.auditService?.record?.({

                action:

                    'PAYMENT_EVENT_PUBLISHED',



                eventType:

                    type,



                transactionId,



                tenantId,



                correlationId:

                    event.correlationId



            });








            this.metrics?.counter?.(

                'payment_events_published_total',

                {

                    type

                }

            );








            this.logger?.debug?.({

                event:

                    'payment.event.published',



                type,



                transactionId,



                correlationId:

                    event.correlationId



            });








            return event;



        }



        catch(error) {



            this.metrics?.counter?.(

                'payment_events_failed_total',

                {

                    type

                }

            );








            this.logger?.error?.({

                event:

                    'payment.event.publish.failed',



                type,



                error



            });








            throw error;



        }



        finally {



            span?.end?.();



        }


    }








    /**
     * =========================================================================
     * Payment Created Event
     * =========================================================================
     */


    async paymentCreated(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_CREATED,

            ...data

        });


    }








    /**
     * =========================================================================
     * Payment Submitted Event
     * =========================================================================
     */


    async paymentSubmitted(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_SUBMITTED,

            ...data

        });


    }








    /**
     * =========================================================================
     * Payment Successful Event
     * =========================================================================
     */


    async paymentSuccessful(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_SUCCESSFUL,

            ...data

        });


    }








    /**
     * =========================================================================
     * Payment Failed Event
     * =========================================================================
     */


    async paymentFailed(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_FAILED,

            ...data

        });


    }








    /**
     * =========================================================================
     * Callback Received Event
     * =========================================================================
     */


    async callbackReceived(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_CALLBACK_RECEIVED,

            ...data

        });


    }








    /**
     * =========================================================================
     * Settlement Completed Event
     * =========================================================================
     */


    async settlementCompleted(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_SETTLEMENT_COMPLETED,

            ...data

        });


    }








    /**
     * =========================================================================
     * Ledger Posted Event
     * =========================================================================
     */


    async ledgerPosted(data) {



        return this.publish({

            type:

                PAYMENT_EVENTS.PAYMENT_LEDGER_POSTED,

            ...data

        });


    }








    /**
     * =========================================================================
     * Health Check
     * =========================================================================
     */


    health() {



        return {



            module:

                'PAYMENT_EVENT_PUBLISHER',



            status:

                this.eventBus

                    ? 'READY'

                    : 'DEGRADED'



        };


    }


}








module.exports = {



    PaymentEventPublisher,



    PAYMENT_EVENTS


};