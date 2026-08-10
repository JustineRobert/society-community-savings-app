'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Constants
 * ============================================================================
 *
 * Central transaction configuration and domain constants.
 *
 * Provides:
 *
 *  - Transaction states
 *  - Transaction types
 *  - Lifecycle transitions
 *  - Processing priorities
 *  - Retry configuration
 *  - Timeout configuration
 *  - Lock configuration
 *  - Compensation policies
 *  - Audit actions
 *
 * ============================================================================
 */



/**
 * ============================================================================
 * Transaction Lifecycle States
 * ============================================================================
 */


const TransactionStates = Object.freeze({


    CREATED:

        'CREATED',



    VALIDATING:

        'VALIDATING',



    VALIDATED:

        'VALIDATED',



    PENDING:

        'PENDING',



    PROCESSING:

        'PROCESSING',



    AUTHORIZING:

        'AUTHORIZING',



    COMPLETED:

        'COMPLETED',



    FAILED:

        'FAILED',



    CANCELLED:

        'CANCELLED',



    TIMEOUT:

        'TIMEOUT',



    ROLLBACK_PENDING:

        'ROLLBACK_PENDING',



    ROLLING_BACK:

        'ROLLING_BACK',



    ROLLED_BACK:

        'ROLLED_BACK',



    COMPENSATING:

        'COMPENSATING',



    COMPENSATED:

        'COMPENSATED',



    RECOVERING:

        'RECOVERING'


});





/**
 * ============================================================================
 * Allowed State Transitions
 * ============================================================================
 */


const TransactionTransitions = Object.freeze({


    CREATED: [

        TransactionStates.VALIDATING,

        TransactionStates.CANCELLED

    ],



    VALIDATING: [

        TransactionStates.VALIDATED,

        TransactionStates.FAILED

    ],



    VALIDATED: [

        TransactionStates.PENDING,

        TransactionStates.FAILED

    ],



    PENDING: [

        TransactionStates.PROCESSING,

        TransactionStates.CANCELLED,

        TransactionStates.TIMEOUT

    ],



    PROCESSING: [

        TransactionStates.COMPLETED,

        TransactionStates.FAILED,

        TransactionStates.TIMEOUT,

        TransactionStates.ROLLBACK_PENDING

    ],



    COMPLETED: [],



    FAILED: [

        TransactionStates.RECOVERING,

        TransactionStates.ROLLBACK_PENDING

    ],



    TIMEOUT: [

        TransactionStates.RECOVERING,

        TransactionStates.ROLLBACK_PENDING

    ],



    ROLLBACK_PENDING: [

        TransactionStates.ROLLING_BACK

    ],



    ROLLING_BACK: [

        TransactionStates.ROLLED_BACK,

        TransactionStates.COMPENSATING

    ],



    COMPENSATING: [

        TransactionStates.COMPENSATED,

        TransactionStates.FAILED

    ],



    RECOVERING: [

        TransactionStates.PROCESSING,

        TransactionStates.COMPLETED,

        TransactionStates.FAILED

    ]


});





/**
 * ============================================================================
 * Transaction Types
 * ============================================================================
 */


const TransactionTypes = Object.freeze({


    DEPOSIT:

        'DEPOSIT',



    WITHDRAWAL:

        'WITHDRAWAL',



    TRANSFER:

        'TRANSFER',



    PAYMENT:

        'PAYMENT',



    LOAN_DISBURSEMENT:

        'LOAN_DISBURSEMENT',



    LOAN_REPAYMENT:

        'LOAN_REPAYMENT',



    SAVINGS_CONTRIBUTION:

        'SAVINGS_CONTRIBUTION',



    INTEREST_ACCRUAL:

        'INTEREST_ACCRUAL',



    FEE_CHARGE:

        'FEE_CHARGE',



    REFUND:

        'REFUND',



    REVERSAL:

        'REVERSAL',



    SETTLEMENT:

        'SETTLEMENT'


});





/**
 * ============================================================================
 * Transaction Sources
 * ============================================================================
 */


const TransactionSources = Object.freeze({


    API:

        'API',



    MOBILE_APP:

        'MOBILE_APP',



    WEB:

        'WEB',



    MTN_MOMO:

        'MTN_MOMO',



    AIRTEL_MONEY:

        'AIRTEL_MONEY',



    BANK:

        'BANK',



    SYSTEM:

        'SYSTEM',



    JOB:

        'JOB'


});





/**
 * ============================================================================
 * Processing Priority
 * ============================================================================
 */


const TransactionPriority = Object.freeze({


    LOW:

        1,



    NORMAL:

        5,



    HIGH:

        8,



    CRITICAL:

        10


});





/**
 * ============================================================================
 * Retry Configuration
 * ============================================================================
 */


const RetryConstants = Object.freeze({


    DEFAULT_ATTEMPTS:

        5,



    INITIAL_DELAY_MS:

        1000,



    MAX_DELAY_MS:

        60000,



    BACKOFF_FACTOR:

        2,



    RETRYABLE_STATES: [

        TransactionStates.FAILED,

        TransactionStates.TIMEOUT

    ]


});





/**
 * ============================================================================
 * Timeout Configuration
 * ============================================================================
 */


const TimeoutConstants = Object.freeze({


    DEFAULT_TRANSACTION_TIMEOUT_MS:

        30000,



    PAYMENT_TIMEOUT_MS:

        60000,



    LEDGER_TIMEOUT_MS:

        10000,



    LOCK_TIMEOUT_MS:

        15000,



    COMPENSATION_TIMEOUT_MS:

        60000


});





/**
 * ============================================================================
 * Lock Configuration
 * ============================================================================
 */


const LockConstants = Object.freeze({


    DEFAULT_TTL_MS:

        30000,



    RETRY_INTERVAL_MS:

        250,



    MAX_RETRIES:

        20,



    PREFIX:

        'transaction:lock'


});





/**
 * ============================================================================
 * Idempotency Configuration
 * ============================================================================
 */


const IdempotencyConstants = Object.freeze({


    KEY_PREFIX:

        'transaction:idempotency',



    DEFAULT_TTL_SECONDS:

        86400,



    STATUS_PROCESSING:

        'PROCESSING',



    STATUS_COMPLETED:

        'COMPLETED',



    STATUS_FAILED:

        'FAILED'


});





/**
 * ============================================================================
 * Compensation Constants
 * ============================================================================
 */


const CompensationConstants = Object.freeze({


    STATES: {


        PENDING:

            'PENDING',



        EXECUTING:

            'EXECUTING',



        COMPLETED:

            'COMPLETED',



        FAILED:

            'FAILED'


    },



    MAX_ATTEMPTS:

        5


});





/**
 * ============================================================================
 * Audit Actions
 * ============================================================================
 */


const TransactionAuditActions = Object.freeze({


    CREATED:

        'TRANSACTION_CREATED',



    VALIDATED:

        'TRANSACTION_VALIDATED',



    STARTED:

        'TRANSACTION_STARTED',



    COMPLETED:

        'TRANSACTION_COMPLETED',



    FAILED:

        'TRANSACTION_FAILED',



    ROLLBACK:

        'TRANSACTION_ROLLBACK',



    COMPENSATION:

        'TRANSACTION_COMPENSATION',



    RECOVERY:

        'TRANSACTION_RECOVERY'


});





/**
 * ============================================================================
 * Financial Precision
 * ============================================================================
 */


const FinancialConstants = Object.freeze({


    DEFAULT_CURRENCY:

        'UGX',



    DECIMAL_PLACES:

        2,



    MIN_TRANSACTION_AMOUNT:

        0.01,


    
    MAX_TRANSACTION_AMOUNT:

        1000000000


});





/**
 * ============================================================================
 * Export
 * ============================================================================
 */


module.exports = {


    TransactionStates,


    TransactionTransitions,


    TransactionTypes,


    TransactionSources,


    TransactionPriority,


    RetryConstants,


    TimeoutConstants,


    LockConstants,


    IdempotencyConstants,


    CompensationConstants,


    TransactionAuditActions,


    FinancialConstants


};