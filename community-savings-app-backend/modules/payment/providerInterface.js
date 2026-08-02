'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Payment Provider Interface
 * =============================================================================
 *
 * Provider abstraction contract for all external payment rails.
 *
 * Implemented by:
 *
 * • MTN MoMo Provider
 * • Airtel Money Provider
 * • Bank Payment Providers
 * • Future Wallet Providers
 *
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 *
 * ✓ Define provider contract
 * ✓ Standardize payment operations
 * ✓ Normalize provider errors
 * ✓ Enforce implementation consistency
 * ✓ Support orchestration engine
 * ✓ Support multi-provider routing
 *
 *
 * Does NOT
 * -----------------------------------------------------------------------------
 *
 * ✗ Execute HTTP calls
 * ✗ Store transactions
 * ✗ Post ledger entries
 * ✗ Manage retries
 *
 * =============================================================================
 */





/**
 * =============================================================================
 * Payment Provider Error
 * =============================================================================
 */


class PaymentProviderError extends Error {



    constructor({

        code = 'PAYMENT_PROVIDER_ERROR',

        message = 'Payment provider error',

        provider = null,

        operation = null,

        retryable = false,

        cause = null,

        metadata = {},

        correlationId = null,

        tenantId = null

    } = {}) {



        super(message);



        Error.captureStackTrace?.(

            this,

            this.constructor

        );





        this.name =

            'PaymentProviderError';





        this.code = code;



        this.provider = provider;



        this.operation = operation;



        this.retryable = retryable;



        this.cause = cause;



        this.metadata = metadata;



        this.correlationId = correlationId;



        this.tenantId = tenantId;



        this.timestamp = new Date();


    }








    isRetryable() {



        return this.retryable;


    }








    toJSON() {



        return {



            name:

                this.name,



            code:

                this.code,



            message:

                this.message,



            provider:

                this.provider,



            operation:

                this.operation,



            retryable:

                this.retryable,



            correlationId:

                this.correlationId,



            tenantId:

                this.tenantId,



            metadata:

                this.metadata,



            timestamp:

                this.timestamp


        };


    }


}









/**
 * =============================================================================
 * Payment Provider Interface
 * =============================================================================
 */


class PaymentProviderInterface {



    constructor(config = {}) {



        if (

            new.target ===

            PaymentProviderInterface

        ) {



            throw new Error(

                'PaymentProviderInterface cannot be instantiated directly'

            );


        }





        this.config = config;



        this.providerName =

            this.constructor.name;



    }








    /**
     * =========================================================================
     * Provider Initialization
     * =========================================================================
     */


    async initialize() {



        throw this.notImplemented(

            'initialize'

        );


    }








    /**
     * =========================================================================
     * Authentication
     * =========================================================================
     */


    async authenticate() {



        throw this.notImplemented(

            'authenticate'

        );


    }








    /**
     * =========================================================================
     * Collection / Incoming Payment
     * =========================================================================
     */


    async collect() {



        throw this.notImplemented(

            'collect'

        );


    }








    /**
     * =========================================================================
     * Disbursement / Outgoing Payment
     * =========================================================================
     */


    async disburse() {



        throw this.notImplemented(

            'disburse'

        );


    }








    /**
     * =========================================================================
     * Transaction Query
     * =========================================================================
     */


    async queryTransaction() {



        throw this.notImplemented(

            'queryTransaction'

        );


    }








    /**
     * =========================================================================
     * Callback Processing
     * =========================================================================
     */


    async processCallback() {



        throw this.notImplemented(

            'processCallback'

        );


    }








    /**
     * =========================================================================
     * Reconciliation
     * =========================================================================
     */


    async reconcile() {



        throw this.notImplemented(

            'reconcile'

        );


    }








    /**
     * =========================================================================
     * Settlement
     * =========================================================================
     */


    async settle() {



        throw this.notImplemented(

            'settle'

        );


    }








    /**
     * =========================================================================
     * Provider Health
     * =========================================================================
     */


    async health() {



        return {



            provider:

                this.providerName,



            status:

                'UNKNOWN'



        };


    }








    /**
     * =========================================================================
     * Capability Discovery
     * =========================================================================
     */


    capabilities() {



        return {



            collect:

                typeof this.collect ===

                'function',



            disburse:

                typeof this.disburse ===

                'function',



            query:

                typeof this.queryTransaction ===

                'function',



            callback:

                typeof this.processCallback ===

                'function',



            reconciliation:

                typeof this.reconcile ===

                'function',



            settlement:

                typeof this.settle ===

                'function'



        };


    }








    /**
     * =========================================================================
     * Interface Enforcement Helper
     * =========================================================================
     */


    notImplemented(method) {



        return new PaymentProviderError({



            code:

                'PROVIDER_METHOD_NOT_IMPLEMENTED',



            message:

                `${this.providerName}.${method}() must be implemented`,



            provider:

                this.providerName,



            operation:

                method



        });


    }


}








/**
 * =============================================================================
 * Provider Lifecycle States
 * =============================================================================
 */


const PROVIDER_STATUS = Object.freeze({



    INITIALIZING:

        'INITIALIZING',



    READY:

        'READY',



    DEGRADED:

        'DEGRADED',



    UNAVAILABLE:

        'UNAVAILABLE',



    DISABLED:

        'DISABLED'


});









/**
 * =============================================================================
 * Provider Operations
 * =============================================================================
 */


const PROVIDER_OPERATIONS = Object.freeze({



    AUTHENTICATE:

        'AUTHENTICATE',



    COLLECTION:

        'COLLECTION',



    DISBURSEMENT:

        'DISBURSEMENT',



    QUERY:

        'QUERY',



    CALLBACK:

        'CALLBACK',



    RECONCILIATION:

        'RECONCILIATION',



    SETTLEMENT:

        'SETTLEMENT'


});








module.exports = {



    PaymentProviderInterface,



    PaymentProviderError,



    PROVIDER_STATUS,



    PROVIDER_OPERATIONS


};