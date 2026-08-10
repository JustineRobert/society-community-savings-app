'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Errors
 * ============================================================================
 *
 * Central transaction error framework.
 *
 * Provides:
 *
 *  - Standard error codes
 *  - Financial error classification
 *  - Retry decisions
 *  - Compensation decisions
 *  - Provider error mapping
 *  - API-safe serialization
 *
 * ============================================================================
 */



/**
 * ============================================================================
 * Error Codes
 * ============================================================================
 */


const TransactionErrorCodes = Object.freeze({


    /**
     * Validation
     */

    VALIDATION_FAILED:

        'TX_VALIDATION_FAILED',


    INVALID_AMOUNT:

        'TX_INVALID_AMOUNT',


    INVALID_CURRENCY:

        'TX_INVALID_CURRENCY',


    INVALID_ACCOUNT:

        'TX_INVALID_ACCOUNT',




    /**
     * Idempotency
     */

    DUPLICATE_TRANSACTION:

        'TX_DUPLICATE_TRANSACTION',


    IDEMPOTENCY_CONFLICT:

        'TX_IDEMPOTENCY_CONFLICT',




    /**
     * State
     */

    INVALID_STATE:

        'TX_INVALID_STATE',


    INVALID_TRANSITION:

        'TX_INVALID_TRANSITION',




    /**
     * Locking
     */

    LOCK_FAILED:

        'TX_LOCK_FAILED',


    LOCK_TIMEOUT:

        'TX_LOCK_TIMEOUT',




    /**
     * Execution
     */

    EXECUTION_FAILED:

        'TX_EXECUTION_FAILED',


    TIMEOUT:

        'TX_TIMEOUT',


    SERVICE_UNAVAILABLE:

        'TX_SERVICE_UNAVAILABLE',




    /**
     * Ledger
     */

    LEDGER_POST_FAILED:

        'TX_LEDGER_POST_FAILED',


    LEDGER_BALANCE_ERROR:

        'TX_LEDGER_BALANCE_ERROR',


    LEDGER_REVERSAL_FAILED:

        'TX_LEDGER_REVERSAL_FAILED',




    /**
     * Payment
     */

    PAYMENT_FAILED:

        'TX_PAYMENT_FAILED',


    PAYMENT_TIMEOUT:

        'TX_PAYMENT_TIMEOUT',


    PAYMENT_PROVIDER_ERROR:

        'TX_PAYMENT_PROVIDER_ERROR',




    /**
     * Settlement
     */

    SETTLEMENT_FAILED:

        'TX_SETTLEMENT_FAILED',




    /**
     * Recovery
     */

    ROLLBACK_FAILED:

        'TX_ROLLBACK_FAILED',


    COMPENSATION_FAILED:

        'TX_COMPENSATION_FAILED',




    /**
     * Security
     */

    UNAUTHORIZED:

        'TX_UNAUTHORIZED',


    FORBIDDEN:

        'TX_FORBIDDEN',




    /**
     * Unknown
     */

    UNKNOWN:

        'TX_UNKNOWN_ERROR'


});





/**
 * ============================================================================
 * Error Severity
 * ============================================================================
 */


const TransactionErrorSeverity = Object.freeze({


    LOW:

        'LOW',


    MEDIUM:

        'MEDIUM',


    HIGH:

        'HIGH',


    CRITICAL:

        'CRITICAL'


});





/**
 * ============================================================================
 * Base Transaction Error
 * ============================================================================
 */


class TransactionError extends Error {


    constructor(message, options = {}) {


        super(message);



        this.name =

            'TransactionError';



        this.code =

            options.code ||

            TransactionErrorCodes.UNKNOWN;



        this.statusCode =

            options.statusCode ||

            500;



        this.severity =

            options.severity ||

            TransactionErrorSeverity.MEDIUM;



        this.retryable =

            options.retryable || false;



        this.requiresCompensation =

            options.requiresCompensation || false;



        this.metadata =

            options.metadata || {};



        this.transactionId =

            options.transactionId || null;



        this.tenantId =

            options.tenantId || null;



        Error.captureStackTrace(

            this,

            this.constructor

        );


    }





    /**
     * =========================================================================
     * Serialization
     * =========================================================================
     */


    serialize() {


        return {


            name:

                this.name,



            code:

                this.code,



            message:

                this.message,



            severity:

                this.severity,



            retryable:

                this.retryable,



            requiresCompensation:

                this.requiresCompensation,



            transactionId:

                this.transactionId,



            metadata:

                this.metadata


        };


    }


}





/**
 * ============================================================================
 * Specialized Errors
 * ============================================================================
 */



class ValidationError extends TransactionError {


    constructor(message, options = {}) {


        super(

            message,

            {

                ...options,


                code:

                    options.code ||

                    TransactionErrorCodes.VALIDATION_FAILED,


                statusCode:

                    400

            }

        );



        this.name =

            'ValidationError';


    }


}





class DuplicateTransactionError extends TransactionError {


    constructor(message = 'Duplicate transaction detected', options = {}) {


        super(

            message,

            {

                ...options,


                code:

                    TransactionErrorCodes.DUPLICATE_TRANSACTION,


                statusCode:

                    409


            }

        );


        this.name =

            'DuplicateTransactionError';


    }


}





class TimeoutError extends TransactionError {


    constructor(message = 'Transaction timeout', options = {}) {


        super(

            message,

            {

                ...options,


                code:

                    TransactionErrorCodes.TIMEOUT,


                retryable:

                    true,


                statusCode:

                    504


            }

        );



        this.name =

            'TimeoutError';


    }


}





class LedgerError extends TransactionError {


    constructor(message, options = {}) {


        super(

            message,

            {

                ...options,


                code:

                    options.code ||

                    TransactionErrorCodes.LEDGER_POST_FAILED,


                severity:

                    TransactionErrorSeverity.CRITICAL,


                requiresCompensation:

                    true


            }

        );



        this.name =

            'LedgerError';


    }


}





class PaymentError extends TransactionError {


    constructor(message, options = {}) {


        super(

            message,

            {

                ...options,


                code:

                    options.code ||

                    TransactionErrorCodes.PAYMENT_FAILED,


                retryable:

                    true


            }

        );



        this.name =

            'PaymentError';


    }


}





class CompensationError extends TransactionError {


    constructor(message, options = {}) {


        super(

            message,

            {

                ...options,


                code:

                    TransactionErrorCodes.COMPENSATION_FAILED,


                severity:

                    TransactionErrorSeverity.CRITICAL


            }

        );



        this.name =

            'CompensationError';


    }


}







/**
 * ============================================================================
 * Error Utilities
 * ============================================================================
 */


class TransactionErrorUtils {



    static isRetryable(error) {


        return Boolean(

            error?.retryable

        );


    }




    static requiresRollback(error) {


        return Boolean(

            error?.requiresCompensation

        );


    }




    static normalize(error) {


        if (

            error instanceof TransactionError

        ) {


            return error;


        }



        return new TransactionError(

            error.message || 'Unknown transaction error',

            {

                code:

                    TransactionErrorCodes.UNKNOWN,


                metadata:

                    {

                        originalError:

                            error.name

                    }

            }

        );


    }




    static fromProviderError(error, provider) {


        return new PaymentError(

            `Payment provider failure: ${provider}`,

            {


                metadata:

                    {

                        provider,


                        original:

                            error.message

                    },


                retryable:

                    true

            }

        );


    }


}





/**
 * ============================================================================
 * Exports
 * ============================================================================
 */


module.exports = {


    TransactionError,


    ValidationError,


    DuplicateTransactionError,


    TimeoutError,


    LedgerError,


    PaymentError,


    CompensationError,


    TransactionErrorCodes,


    TransactionErrorSeverity,


    TransactionErrorUtils


};