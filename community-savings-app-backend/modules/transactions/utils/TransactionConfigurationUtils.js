'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Transaction Configuration Utilities
 * ============================================================================
 *
 * Provides:
 *
 * - mergeConfiguration()
 * - normalizeConfiguration()
 * - resolveDefaults()
 * - configuration sanitization
 *
 * Design goals:
 *
 * - Predictable runtime behavior
 * - Immutable configuration flow
 * - Safe environment overrides
 * - Production configuration hygiene
 *
 * ============================================================================
 */


const {
    deepClone,
    deepFreeze,
    isPlainObject
} = require('./TransactionObjectUtils');



/**
 * ============================================================================
 * Default Publisher Configuration
 * ============================================================================
 */


const DEFAULT_CONFIGURATION = Object.freeze({

    enabled: true,


    namespace:

        'transactions.events',


    batch: {


        enabled: true,


        maxSize:

            100,


        flushIntervalMs:

            1000,


        concurrency:

            4


    },


    retry: {


        enabled: true,


        maxAttempts:

            10,


        initialDelayMs:

            1000,


        maxDelayMs:

            60000,


        backoffFactor:

            2


    },


    outbox: {


        pollingIntervalMs:

            500,


        cleanupIntervalMs:

            3600000


    },


    health: {


        enabled:

            true,


        staleThresholdMs:

            30000


    }


});





/**
 * ============================================================================
 * Deep Configuration Merge
 * ============================================================================
 *
 * Does not mutate source objects.
 *
 */


function mergeConfiguration(
    base = {},
    override = {}
) {


    const target =

        deepClone(base);



    if (

        !isPlainObject(override)

    ) {


        return target;


    }



    Object.keys(override)

        .forEach(

            key => {


                const incoming =

                    override[key];



                if (

                    isPlainObject(incoming)

                    &&

                    isPlainObject(target[key])

                ) {


                    target[key] =

                        mergeConfiguration(

                            target[key],

                            incoming

                        );


                }

                else {


                    target[key] =

                        deepClone(

                            incoming

                        );


                }


            }

        );



    return target;


}





/**
 * ============================================================================
 * Resolve Defaults
 * ============================================================================
 *
 * Priority:
 *
 * runtime config
 *      >
 * environment config
 *      >
 * default config
 *
 */


function resolveDefaults(
    configuration = {},
    environment = {}
) {


    return mergeConfiguration(

        mergeConfiguration(

            DEFAULT_CONFIGURATION,

            environment

        ),

        configuration

    );


}





/**
 * ============================================================================
 * Normalize Configuration
 * ============================================================================
 *
 * Converts values into predictable runtime formats.
 *
 */


function normalizeConfiguration(
    configuration = {}
) {


    const normalized =

        deepClone(

            configuration

        );



    normalized.enabled =

        Boolean(

            normalized.enabled

        );



    normalized.batch.maxSize =

        normalizePositiveInteger(

            normalized.batch.maxSize,

            DEFAULT_CONFIGURATION.batch.maxSize

        );



    normalized.batch.flushIntervalMs =

        normalizePositiveInteger(

            normalized.batch.flushIntervalMs,

            DEFAULT_CONFIGURATION.batch.flushIntervalMs

        );



    normalized.batch.concurrency =

        normalizePositiveInteger(

            normalized.batch.concurrency,

            DEFAULT_CONFIGURATION.batch.concurrency

        );



    normalized.retry.maxAttempts =

        normalizePositiveInteger(

            normalized.retry.maxAttempts,

            DEFAULT_CONFIGURATION.retry.maxAttempts

        );



    normalized.retry.initialDelayMs =

        normalizePositiveInteger(

            normalized.retry.initialDelayMs,

            DEFAULT_CONFIGURATION.retry.initialDelayMs

        );



    normalized.retry.maxDelayMs =

        normalizePositiveInteger(

            normalized.retry.maxDelayMs,

            DEFAULT_CONFIGURATION.retry.maxDelayMs

        );



    normalized.namespace =

        sanitizeString(

            normalized.namespace

        );



    return deepFreeze(

        normalized

    );


}





/**
 * ============================================================================
 * Positive Integer Normalization
 * ============================================================================
 */


function normalizePositiveInteger(
    value,
    fallback
) {


    const number =

        Number(value);



    if (

        Number.isInteger(number)

        &&

        number > 0

    ) {


        return number;


    }



    return fallback;


}





/**
 * ============================================================================
 * String Sanitization
 * ============================================================================
 */


function sanitizeString(value) {


    if (

        typeof value !== 'string'

    ) {


        return 'transactions.events';


    }



    return value

        .trim()

        .replace(

            /[^a-zA-Z0-9._:-]/g,

            ''

        )

        .substring(

            0,

            100

        );


}





/**
 * ============================================================================
 * Remove Sensitive Configuration
 * ============================================================================
 *
 * Prevents secrets leaking into logs.
 *
 */


function sanitizeForLogging(configuration = {}) {


    const sanitized =

        deepClone(

            configuration

        );



    const sensitiveKeys = [

        'password',

        'secret',

        'token',

        'apiKey',

        'privateKey',

        'credentials'

    ];



    function clean(object) {


        if (

            !isPlainObject(object)

        ) {


            return;


        }



        Object.keys(object)

            .forEach(

                key => {


                    if (

                        sensitiveKeys.includes(

                            key

                        )

                    ) {


                        object[key] =

                            '[REDACTED]';


                    }

                    else {


                        clean(

                            object[key]

                        );


                    }


                }

            );


    }



    clean(

        sanitized

    );



    return sanitized;


}





/**
 * ============================================================================
 * Export
 * ============================================================================
 */


module.exports = {


    DEFAULT_CONFIGURATION,


    mergeConfiguration,


    resolveDefaults,


    normalizeConfiguration,


    sanitizeForLogging


};