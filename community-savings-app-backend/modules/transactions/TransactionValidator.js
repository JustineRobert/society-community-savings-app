'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Validator
 * ============================================================================
 *
 * Validates financial transactions before execution.
 *
 * Responsibilities
 * ----------------
 * ✓ Transaction structure validation
 * ✓ Financial amount validation
 * ✓ Currency validation
 * ✓ Tenant validation
 * ✓ Idempotency validation
 * ✓ Provider validation
 * ✓ State validation
 * ✓ Compliance hooks
 * ✓ Risk hooks
 * ✓ Audit integration
 * ✓ Metrics integration
 *
 * ============================================================================
 */


const crypto = require('crypto');


const TransactionValidationError =
    class TransactionValidationError extends Error {


        constructor(errors = []) {

            super(
                'Transaction validation failed'
            );


            this.name =
                'TransactionValidationError';


            this.code =
                'TRANSACTION_VALIDATION_FAILED';


            this.errors =
                errors;


        }


    };



const DEFAULTS = Object.freeze({

    minAmount: 0.01,

    maxAmount: 1000000000,

    supportedCurrencies: [

        'UGX',

        'USD',

        'KES',

        'TZS',

        'RWF'

    ]

});



class TransactionValidator {


    constructor(options = {}) {


        this.logger =
            options.logger || console;



        this.metrics =
            options.metrics;



        this.auditPublisher =
            options.auditPublisher;



        this.accountValidator =
            options.accountValidator;



        this.riskEngine =
            options.riskEngine;



        this.complianceEngine =
            options.complianceEngine;



        this.idempotencyStore =
            options.idempotencyStore;



        this.config = {


            ...DEFAULTS,


            ...options


        };


    }



    /**
     * =========================================================================
     * Validate Transaction
     * =========================================================================
     */


    async validate(transaction = {}, context = {}) {


        const errors = [];



        this.validateRequiredFields(

            transaction,

            errors

        );



        this.validateAmount(

            transaction,

            errors

        );



        this.validateCurrency(

            transaction,

            errors

        );



        this.validateTenant(

            transaction,

            context,

            errors

        );



        this.validateProvider(

            transaction,

            errors

        );



        this.validateIdempotency(

            transaction,

            errors

        );



        this.validateState(

            transaction,

            errors

        );



        if (

            this.accountValidator

        ) {


            await this.validateAccounts(

                transaction,

                errors

            );


        }



        if (

            this.complianceEngine

        ) {


            await this.validateCompliance(

                transaction,

                errors

            );


        }



        if (

            this.riskEngine

        ) {


            await this.validateRisk(

                transaction,

                errors

            );


        }



        const valid =

            errors.length === 0;



        this.metrics?.increment?.(

            valid

                ? 'transaction_validation_success_total'

                : 'transaction_validation_failure_total'

        );



        if (!valid) {


            await this.auditPublisher?.publish?.({

                type:

                    'TRANSACTION_VALIDATION_FAILED',



                transactionId:

                    transaction.transactionId,



                errors,



                timestamp:

                    new Date()

            });



            throw new TransactionValidationError(

                errors

            );


        }



        return {


            valid: true,


            transactionId:

                transaction.transactionId ||


                crypto.randomUUID()


        };


    }



    /**
     * =========================================================================
     * Required Fields
     * =========================================================================
     */


    validateRequiredFields(transaction, errors) {


        const required = [


            'type',


            'amount',


            'currency'


        ];



        required.forEach(field => {


            if (

                transaction[field] === undefined ||

                transaction[field] === null

            ) {


                errors.push({

                    field,

                    message:

                        `${field} is required`

                });


            }


        });


    }



    /**
     * =========================================================================
     * Amount Validation
     * =========================================================================
     */


    validateAmount(transaction, errors) {


        const amount =

            Number(

                transaction.amount

            );



        if (

            Number.isNaN(amount)

        ) {


            errors.push({

                field:

                    'amount',

                message:

                    'Amount must be numeric'

            });


            return;

        }



        if (

            amount <= 0

        ) {


            errors.push({

                field:

                    'amount',

                message:

                    'Amount must be greater than zero'

            });


        }



        if (

            amount <

            this.config.minAmount

        ) {


            errors.push({

                field:

                    'amount',

                message:

                    'Amount below minimum limit'

            });


        }



        if (

            amount >

            this.config.maxAmount

        ) {


            errors.push({

                field:

                    'amount',

                message:

                    'Amount exceeds maximum limit'

            });


        }


    }



    /**
     * =========================================================================
     * Currency Validation
     * =========================================================================
     */


    validateCurrency(transaction, errors) {


        if (

            !this.config.supportedCurrencies.includes(

                transaction.currency

            )

        ) {


            errors.push({

                field:

                    'currency',

                message:

                    'Unsupported currency'

            });


        }


    }



    /**
     * =========================================================================
     * Tenant Validation
     * =========================================================================
     */


    validateTenant(transaction, context, errors) {


        if (

            context.tenantId &&

            transaction.tenantId &&

            context.tenantId !== transaction.tenantId

        ) {


            errors.push({

                field:

                    'tenantId',

                message:

                    'Tenant mismatch'

            });


        }


    }



    /**
     * =========================================================================
     * Provider Validation
     * =========================================================================
     */


    validateProvider(transaction, errors) {


        if (

            transaction.provider &&

            typeof transaction.provider !== 'string'

        ) {


            errors.push({

                field:

                    'provider',

                message:

                    'Invalid provider'

            });


        }


    }



    /**
     * =========================================================================
     * Idempotency Validation
     * =========================================================================
     */


    async validateIdempotency(transaction, errors) {


        if (

            !transaction.idempotencyKey

        ) {


            return;

        }



        if (

            this.idempotencyStore?.exists

        ) {


            const exists =

                await this.idempotencyStore.exists(

                    transaction.idempotencyKey

                );



            if (exists) {


                errors.push({

                    field:

                        'idempotencyKey',

                    message:

                        'Duplicate transaction request'

                });


            }


        }


    }



    /**
     * =========================================================================
     * State Validation
     * =========================================================================
     */


    validateState(transaction, errors) {


        const allowed = [


            undefined,


            null,


            'CREATED',


            'PENDING'


        ];



        if (

            !allowed.includes(

                transaction.state

            )

        ) {


            errors.push({

                field:

                    'state',

                message:

                    'Invalid initial transaction state'

            });


        }


    }



    /**
     * =========================================================================
     * Account Validation Hook
     * =========================================================================
     */


    async validateAccounts(transaction, errors) {


        try {


            await this.accountValidator.validate(

                transaction

            );


        }

        catch(error) {


            errors.push({

                field:

                    'accounts',

                message:

                    error.message

            });


        }


    }



    /**
     * =========================================================================
     * Compliance Hook
     * =========================================================================
     */


    async validateCompliance(transaction, errors) {


        const result =

            await this.complianceEngine.check(

                transaction

            );



        if (

            result.allowed === false

        ) {


            errors.push({

                field:

                    'compliance',

                message:

                    result.reason

            });


        }


    }



    /**
     * =========================================================================
     * Risk Hook
     * =========================================================================
     */


    async validateRisk(transaction, errors) {


        const result =

            await this.riskEngine.evaluate(

                transaction

            );



        if (

            result.blocked

        ) {


            errors.push({

                field:

                    'risk',

                message:

                    'Transaction blocked by risk engine'

            });


        }


    }



    /**
     * =========================================================================
     * Helpers
     * =========================================================================
     */


    isValid(transaction) {


        try {


            this.validate(

                transaction

            );


            return true;


        }

        catch(error) {


            return false;


        }


    }



}



TransactionValidator.Error =
    TransactionValidationError;



module.exports = TransactionValidator;