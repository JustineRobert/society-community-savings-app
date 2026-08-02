'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Payment Module Registry
 * =============================================================================
 *
 * Central composition boundary for the TITech payment infrastructure.
 *
 * Responsibilities:
 *
 * ✓ Register payment services
 * ✓ Compose shared payment infrastructure
 * ✓ Expose provider adapters
 * ✓ Provide dependency injection boundary
 * ✓ Initialize payment capabilities
 * ✓ Standardize payment module exports
 *
 *
 * Supported:
 *
 * • MTN MoMo
 * • Airtel Money (future)
 * • Banking integrations (future)
 * • Collections
 * • Disbursements
 * • Callback processing
 * • Reconciliation
 * • Settlement
 * • Ledger integration
 *
 *
 * Does NOT:
 *
 * ✗ Start HTTP server
 * ✗ Manage database connections
 * ✗ Handle authentication
 * ✗ Own business workflows
 *
 * =============================================================================
 */



/**
 * =============================================================================
 * Shared Infrastructure
 * =============================================================================
 */


const PaymentConfiguration =

    require('./shared/configuration');



const PaymentErrors =

    require('./shared/errors');



const RequestBuilder =

    require('./shared/requestBuilder');



const ResponseNormalizer =

    require('./shared/responseNormalizer');



const SignatureService =

    require('./shared/signature');








/**
 * =============================================================================
 * MTN Provider Components
 * =============================================================================
 */


const MTNConfiguration =

    require('./mtn/configuration');



const MTNAuthService =

    require('./mtn/auth');



const CollectionsService =

    require('./mtn/collections');



const DisbursementService =

    require('./mtn/disbursements');



const CallbackService =

    require('./mtn/callbacks');








/**
 * =============================================================================
 * Payment Module Factory
 * =============================================================================
 */


class PaymentModule {



    constructor({

        logger,

        metrics,

        tracer,

        dependencies = {}

    } = {}) {



        this.logger = logger;

        this.metrics = metrics;

        this.tracer = tracer;



        this.dependencies = dependencies;



        this.initialized = false;



    }








    /**
     * =========================================================================
     * Initialize Payment Infrastructure
     * =========================================================================
     */


    initialize() {



        if (this.initialized) {



            return this;


        }







        this.configuration =

            new PaymentConfiguration({

                ...this.dependencies.configuration

            });








        this.requestBuilder =

            new RequestBuilder({

                configuration:

                    this.configuration,

                logger:

                    this.logger,

                tracer:

                    this.tracer

            });








        this.responseNormalizer =

            new ResponseNormalizer({

                logger:

                    this.logger,

                metrics:

                    this.metrics

            });








        this.signatureService =

            new SignatureService({

                secret:

                    process.env.PAYMENT_SIGNATURE_SECRET,

                logger:

                    this.logger,

                metrics:

                    this.metrics

            });








        this.mtn =

            this.initializeMTN();








        this.initialized = true;







        this.logger?.info?.({

            event:

                'payment.module.initialized'

        });








        return this;


    }








    /**
     * =========================================================================
     * Initialize MTN Provider
     * =========================================================================
     */


    initializeMTN() {



        const configuration =

            new MTNConfiguration();







        return Object.freeze({



            configuration,



            auth:

                new MTNAuthService({

                    configuration,

                    logger:

                        this.logger

                }),





            collections:

                new CollectionsService({

                    configuration,

                    requestBuilder:

                        this.requestBuilder,

                    responseNormalizer:

                        this.responseNormalizer,

                    logger:

                        this.logger

                }),





            disbursements:

                new DisbursementService({

                    configuration,

                    requestBuilder:

                        this.requestBuilder,

                    responseNormalizer:

                        this.responseNormalizer,

                    logger:

                        this.logger

                }),





            callbacks:

                new CallbackService({

                    signatureService:

                        this.signatureService,

                    responseNormalizer:

                        this.responseNormalizer,

                    logger:

                        this.logger

                })


        });


    }








    /**
     * =========================================================================
     * Health Status
     * =========================================================================
     */


    health() {



        return {



            module:

                'PAYMENT_MODULE',



            initialized:

                this.initialized,



            providers: {



                MTN:

                    Boolean(

                        this.mtn

                    )



            },



            status:

                this.initialized

                    ? 'READY'

                    : 'NOT_INITIALIZED'



        };


    }


}








/**
 * =============================================================================
 * Factory
 * =============================================================================
 */


function createPaymentModule(options = {}) {



    return new PaymentModule(options)

        .initialize();


}








module.exports = {



    PaymentModule,



    createPaymentModule,



    PaymentConfiguration,



    RequestBuilder,



    ResponseNormalizer,



    SignatureService,



    Errors:

        PaymentErrors


};