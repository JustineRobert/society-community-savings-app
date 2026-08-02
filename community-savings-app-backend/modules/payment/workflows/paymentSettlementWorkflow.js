'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Payment Settlement Workflow Engine
 * =============================================================================
 *
 * Purpose
 * -------
 * Enterprise settlement orchestration workflow.
 *
 * Responsible for:
 *
 * ✓ Provider settlement processing
 * ✓ Payment confirmation lifecycle
 * ✓ Ledger settlement coordination
 * ✓ Reconciliation triggering
 * ✓ Settlement event publishing
 * ✓ Idempotent settlement execution
 * ✓ Failure recovery handling
 * ✓ Audit trail generation
 * ✓ Operational metrics
 *
 *
 * Supported providers:
 *
 * • MTN MoMo
 * • Airtel Money
 * • Banking providers
 *
 *
 * Does NOT:
 *
 * ✗ Directly modify balances
 * ✗ Bypass ledger engine
 * ✗ Perform provider API calls directly
 * ✗ Own payment state storage
 *
 *
 * Architecture:
 *
 *
 * Provider Settlement Callback
 *
 *          |
 *          ▼
 *
 * Payment Settlement Workflow
 *
 *          |
 *          +----------------+
 *          |                |
 *          ▼                ▼
 *
 * Ledger Engine       Reconciliation Engine
 *
 *          |
 *          ▼
 *
 * Settlement Events
 *
 * =============================================================================
 */



const crypto = require('crypto');








const SETTLEMENT_STATUS = Object.freeze({



    CREATED:

        'CREATED',



    PROCESSING:

        'PROCESSING',



    SETTLED:

        'SETTLED',



    FAILED:

        'FAILED',



    REQUIRES_REVIEW:

        'REQUIRES_REVIEW'


});









class PaymentSettlementWorkflow {



    constructor({

        settlementRepository,

        settlementTracker,

        ledgerBridge,

        reconciliationService,

        eventPublisher,

        idempotencyManager,

        auditService,

        logger,

        metrics,

        tracer

    } = {}) {



        this.settlementRepository =

            settlementRepository;



        this.settlementTracker =

            settlementTracker;



        this.ledgerBridge =

            ledgerBridge;



        this.reconciliationService =

            reconciliationService;



        this.eventPublisher =

            eventPublisher;



        this.idempotencyManager =

            idempotencyManager;



        this.auditService =

            auditService;



        this.logger =

            logger;



        this.metrics =

            metrics;



        this.tracer =

            tracer;



    }









    /**
     * =========================================================================
     * Execute Settlement Workflow
     * =========================================================================
     */


    async execute({



        tenantId,

        paymentId,

        provider,

        externalReference,

        amount,

        currency = 'UGX',

        metadata = {}



    }) {



        const correlationId =

            crypto.randomUUID();







        const span =

            this.tracer?.startSpan?.(

                'payment.settlement.workflow'

            );







        try {



            /**
             * ---------------------------------------------------------------
             * 1. Idempotency protection
             * ---------------------------------------------------------------
             */


            await this.idempotencyManager?.check?.({



                tenantId,

                reference:

                    externalReference



            });








            /**
             * ---------------------------------------------------------------
             * 2. Create settlement record
             * ---------------------------------------------------------------
             */


            const settlement =

                await this.settlementRepository.create({



                    tenantId,



                    paymentId,



                    provider,



                    externalReference,



                    amount,



                    currency,



                    status:

                        SETTLEMENT_STATUS.PROCESSING,



                    correlationId,



                    metadata



                });








            /**
             * ---------------------------------------------------------------
             * 3. Post settlement into ledger
             * ---------------------------------------------------------------
             */


            const ledgerResult =

                await this.ledgerBridge.postSettlement({



                    tenantId,



                    settlement



                });








            /**
             * ---------------------------------------------------------------
             * 4. Mark settlement successful
             * ---------------------------------------------------------------
             */


            const completed =

                await this.settlementRepository.update(

                    settlement.id,

                    {



                        status:

                            SETTLEMENT_STATUS.SETTLED,



                        ledgerReference:

                            ledgerResult.reference,



                        settledAt:

                            new Date()



                    }

                );








            /**
             * ---------------------------------------------------------------
             * 5. Register reconciliation
             * ---------------------------------------------------------------
             */


            await this.reconciliationService?.queue?.({



                tenantId,



                paymentId,



                settlementId:

                    settlement.id



            });








            /**
             * ---------------------------------------------------------------
             * 6. Register idempotency completion
             * ---------------------------------------------------------------
             */


            await this.idempotencyManager?.register?.({



                tenantId,



                reference:

                    externalReference,



                response:

                    completed



            });








            /**
             * ---------------------------------------------------------------
             * 7. Publish settlement event
             * ---------------------------------------------------------------
             */


            await this.eventPublisher?.settlementCompleted?.({



                tenantId,



                transactionId:

                    paymentId,



                provider,



                correlationId,



                payload:

                    completed



            });








            /**
             * ---------------------------------------------------------------
             * 8. Audit
             * ---------------------------------------------------------------
             */


            await this.auditService?.record?.({



                action:

                    'PAYMENT_SETTLEMENT_COMPLETED',



                tenantId,



                paymentId,



                settlementId:

                    settlement.id,



                correlationId



            });








            this.metrics?.counter?.(

                'payment_settlement_success_total',

                {

                    provider

                }

            );








            return completed;



        }



        catch(error) {



            this.metrics?.counter?.(

                'payment_settlement_failed_total',

                {

                    provider

                }

            );








            await this.handleFailure({



                tenantId,



                paymentId,



                externalReference,



                provider,



                error,



                correlationId



            });








            throw error;



        }



        finally {



            span?.end?.();



        }



    }









    /**
     * =========================================================================
     * Handle Settlement Failure
     * =========================================================================
     */


    async handleFailure({



        tenantId,

        paymentId,

        externalReference,

        provider,

        error,

        correlationId



    }) {



        this.logger?.error?.({



            event:

                'payment.settlement.failed',



            tenantId,



            paymentId,



            provider,



            correlationId,



            error



        });








        await this.settlementRepository?.markFailed?.({



            tenantId,



            paymentId,



            reference:

                externalReference,



            error:

                error.message



        });








        await this.eventPublisher?.paymentFailed?.({



            tenantId,



            transactionId:

                paymentId,



            provider,



            correlationId,



            payload: {



                reason:

                    error.message



            }



        });

    }

    /**
     * =========================================================================
     * Retry Settlement
     * =========================================================================
     */


    async retry({



        settlementId



    }) {



        const settlement =

            await this.settlementRepository.findById(

                settlementId

            );

        if (!settlement) {



            throw new Error(

                'Settlement not found'

            );


        }

        return this.execute({



            tenantId:

                settlement.tenantId,



            paymentId:

                settlement.paymentId,



            provider:

                settlement.provider,



            externalReference:

                settlement.externalReference,



            amount:

                settlement.amount,



            currency:

                settlement.currency



        });



    }

    /**
     * =========================================================================
     * Health
     * =========================================================================
     */


    health() {



        return {



            module:

                'PAYMENT_SETTLEMENT_WORKFLOW',



            status:

                'READY'



        };


    }


}


module.exports = {



    PaymentSettlementWorkflow,



    SETTLEMENT_STATUS



};