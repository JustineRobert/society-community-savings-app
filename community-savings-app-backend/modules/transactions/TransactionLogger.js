'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Logger
 * ============================================================================
 *
 * Transaction-aware structured logging service.
 *
 * Features
 * --------
 * ✓ Structured JSON logs
 * ✓ Transaction correlation
 * ✓ Tenant awareness
 * ✓ Request correlation
 * ✓ Sensitive data masking
 * ✓ Error normalization
 * ✓ Child loggers
 * ✓ External logger adapters
 * ✓ Trace correlation
 * ✓ Performance logging
 * ✓ Audit-friendly output
 *
 * ============================================================================
 */


const crypto = require('crypto');


const LogLevel = Object.freeze({

    DEBUG: 'DEBUG',

    INFO: 'INFO',

    WARN: 'WARN',

    ERROR: 'ERROR',

    CRITICAL: 'CRITICAL'

});


const SENSITIVE_FIELDS = new Set([

    'password',

    'token',

    'accessToken',

    'refreshToken',

    'secret',

    'apiKey',

    'authorization',

    'pin',

    'otp',

    'cardNumber'

]);


class TransactionLogger {


    constructor(options = {}) {


        this.logger =

            options.logger || console;



        this.serviceName =

            options.serviceName ||

            'transaction-service';



        this.environment =

            options.environment ||

            process.env.NODE_ENV ||

            'development';



        this.tracer =

            options.tracer;



        this.auditPublisher =

            options.auditPublisher;



        this.metrics =

            options.metrics;



        this.defaultContext = {


            instanceId:

                crypto.randomUUID(),



            service:

                this.serviceName,



            environment:

                this.environment


        };


    }



    /**
     * =========================================================================
     * Create Transaction Logger Context
     * =========================================================================
     */


    createContext(context = {}) {


        return {


            ...this.defaultContext,


            transactionId:

                context.transactionId || null,



            correlationId:

                context.correlationId || null,



            requestId:

                context.requestId || null,



            tenantId:

                context.tenantId || null,



            userId:

                context.userId || null,



            operation:

                context.operation || null,



            provider:

                context.provider || null,



            traceId:

                context.traceId || null



        };


    }



    /**
     * =========================================================================
     * Logging Methods
     * =========================================================================
     */


    debug(message, context = {}, data = {}) {


        return this.log(

            LogLevel.DEBUG,

            message,

            context,

            data

        );

    }



    info(message, context = {}, data = {}) {


        return this.log(

            LogLevel.INFO,

            message,

            context,

            data

        );

    }



    warn(message, context = {}, data = {}) {


        return this.log(

            LogLevel.WARN,

            message,

            context,

            data

        );

    }



    error(message, error, context = {}, data = {}) {


        return this.log(

            LogLevel.ERROR,

            message,

            context,

            {

                ...data,

                error:

                    this.normalizeError(error)

            }

        );

    }



    critical(message, error, context = {}, data = {}) {


        return this.log(

            LogLevel.CRITICAL,

            message,

            context,

            {

                ...data,

                error:

                    this.normalizeError(error)

            }

        );

    }



    /**
     * =========================================================================
     * Core Logger
     * =========================================================================
     */


    log(level, message, context = {}, data = {}) {


        const entry = {


            timestamp:

                new Date().toISOString(),



            level,



            message,



            context:

                this.createContext(

                    context

                ),



            data:

                this.maskSensitive(

                    data

                )


        };



        this.write(entry);



        return entry;


    }



    /**
     * =========================================================================
     * Transaction Lifecycle Logging
     * =========================================================================
     */


    transactionStarted(context) {


        return this.info(

            'Transaction started',

            context

        );


    }



    transactionCommitted(context) {


        return this.info(

            'Transaction committed',

            context

        );


    }



    transactionFailed(context, error) {


        return this.error(

            'Transaction failed',

            error,

            context

        );


    }



    transactionRollback(context, error) {


        return this.warn(

            'Transaction rollback executed',

            context,

            {

                error:

                    error?.message

            }

        );


    }



    transactionTimeout(context) {


        return this.warn(

            'Transaction timeout',

            context

        );


    }



    /**
     * =========================================================================
     * Operation Logging
     * =========================================================================
     */


    operationStarted(name, context) {


        return this.debug(

            `Operation started: ${name}`,

            {

                ...context,

                operation: name

            }

        );


    }



    operationCompleted(name, duration, context) {


        return this.info(

            `Operation completed: ${name}`,

            {

                ...context,

                operation: name

            },

            {

                durationMs:

                    duration

            }

        );


    }



    /**
     * =========================================================================
     * Provider Logging
     * =========================================================================
     */


    providerCall(provider, operation, context, result = {}) {


        return this.info(

            `Provider call: ${provider}.${operation}`,

            {

                ...context,

                provider,

                operation

            },

            result

        );


    }



    /**
     * =========================================================================
     * Error Normalization
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

                error.code || null,



            status:

                error.status || null,



            stack:

                error.stack || null


        };


    }



    /**
     * =========================================================================
     * Sensitive Data Masking
     * =========================================================================
     */


    maskSensitive(value) {


        if (!value) {

            return value;

        }



        if (

            Array.isArray(value)

        ) {


            return value.map(

                item =>

                    this.maskSensitive(item)

            );

        }



        if (

            typeof value === 'object'

        ) {


            const output = {};



            for (

                const [key, val]

                of Object.entries(value)

            ) {


                if (

                    SENSITIVE_FIELDS.has(

                        key

                    )

                ) {


                    output[key] =

                        '[REDACTED]';


                }

                else {


                    output[key] =

                        this.maskSensitive(val);


                }


            }



            return output;


        }



        return value;


    }



    /**
     * =========================================================================
     * Child Logger
     * =========================================================================
     */


    child(context = {}) {


        return {


            debug:

                (msg, data) =>

                    this.debug(

                        msg,

                        context,

                        data

                    ),



            info:

                (msg, data) =>

                    this.info(

                        msg,

                        context,

                        data

                    ),



            warn:

                (msg, data) =>

                    this.warn(

                        msg,

                        context,

                        data

                    ),



            error:

                (msg, error, data) =>

                    this.error(

                        msg,

                        error,

                        context,

                        data

                    )


        };


    }



    /**
     * =========================================================================
     * Performance Measurement
     * =========================================================================
     */


    startTimer(context = {}) {


        const start =

            Date.now();



        return {


            end: () => {


                const duration =

                    Date.now() -

                    start;



                this.metrics?.observe?.(

                    'transaction_log_operation_duration_ms',

                    duration

                );



                return duration;


            }


        };


    }



    /**
     * =========================================================================
     * Output Adapter
     * =========================================================================
     */


    write(entry) {


        const output =

            JSON.stringify(

                entry

            );



        switch(entry.level) {


            case LogLevel.ERROR:

            case LogLevel.CRITICAL:


                this.logger.error(

                    output

                );

                break;



            case LogLevel.WARN:


                this.logger.warn(

                    output

                );

                break;



            case LogLevel.DEBUG:


                this.logger.debug?.(

                    output

                );

                break;



            default:


                this.logger.info(

                    output

                );


        }


    }



    /**
     * =========================================================================
     * Statistics
     * =========================================================================
     */


    getConfiguration() {


        return {


            service:

                this.serviceName,



            environment:

                this.environment


        };


    }


}



TransactionLogger.Levels = LogLevel;


module.exports = TransactionLogger;