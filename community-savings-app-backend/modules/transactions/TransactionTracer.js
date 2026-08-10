'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Tracer
 * ============================================================================
 *
 * Distributed tracing layer for transaction workflows.
 *
 * Features
 * --------
 * ✓ OpenTelemetry integration
 * ✓ Span lifecycle management
 * ✓ Trace propagation
 * ✓ Transaction correlation
 * ✓ Tenant attributes
 * ✓ Error recording
 * ✓ Provider tracing
 * ✓ Performance measurement
 * ✓ Metrics hooks
 * ✓ No-op fallback mode
 *
 * ============================================================================
 */


const crypto = require('crypto');


const SpanStatus = Object.freeze({

    OK: 'OK',

    ERROR: 'ERROR',

    UNSET: 'UNSET'

});


class TransactionTracer {


    constructor(options = {}) {


        this.tracer =

            options.tracer || null;



        this.logger =

            options.logger || console;



        this.metrics =

            options.metrics;



        this.serviceName =

            options.serviceName ||

            'transaction-service';



        this.environment =

            options.environment ||

            process.env.NODE_ENV ||

            'development';



        this.activeSpans = new Map();



        this.statistics = {


            created: 0,


            completed: 0,


            failed: 0


        };


    }



    /**
     * =========================================================================
     * Start Transaction Trace
     * =========================================================================
     */


    startTransaction(context = {}) {


        return this.startSpan(

            'transaction',

            {


                transactionId:

                    context.transactionId,



                correlationId:

                    context.correlationId,



                tenantId:

                    context.tenantId,



                operation:

                    context.operation



            }

        );


    }



    /**
     * =========================================================================
     * Start Span
     * =========================================================================
     */


    startSpan(name, attributes = {}) {


        const spanId =

            crypto.randomUUID();



        const traceId =

            attributes.traceId ||

            crypto.randomUUID();



        const startTime =

            Date.now();



        let otelSpan = null;



        if (

            this.tracer?.startSpan

        ) {


            otelSpan =

                this.tracer.startSpan(

                    name,

                    {


                        attributes:

                            this.buildAttributes(

                                attributes

                            )


                    }

                );


        }



        const span = {


            id:

                spanId,



            traceId,



            name,



            startTime,



            status:

                SpanStatus.UNSET,



            attributes,



            otelSpan


        };



        this.activeSpans.set(

            spanId,

            span

        );



        this.statistics.created++;



        return span;

    }



    /**
     * =========================================================================
     * End Span
     * =========================================================================
     */


    endSpan(span, result = {}) {


        if (!span) {

            return;

        }



        const duration =

            Date.now() -

            span.startTime;



        span.status =

            result.error

                ? SpanStatus.ERROR

                : SpanStatus.OK;



        span.durationMs = duration;



        if (

            span.otelSpan

        ) {


            if (

                result.error

            ) {


                span.otelSpan.recordException(

                    result.error

                );


                span.otelSpan.setStatus({

                    code: 2,

                    message:

                        result.error.message

                });


            }


            span.otelSpan.end();


        }



        this.activeSpans.delete(

            span.id

        );



        this.statistics.completed++;



        if (

            result.error

        ) {


            this.statistics.failed++;


        }



        this.metrics?.observe?.(

            'transaction_trace_duration_ms',

            duration

        );


        return span;

    }



    /**
     * =========================================================================
     * Execute Within Span
     * =========================================================================
     */


    async trace(name, operation, attributes = {}) {


        const span =

            this.startSpan(

                name,

                attributes

            );



        try {


            const result =

                await operation(span);



            this.endSpan(

                span

            );



            return result;


        }

        catch(error) {


            this.endSpan(

                span,

                {

                    error

                }

            );


            throw error;


        }


    }



    /**
     * =========================================================================
     * Transaction Operation Trace
     * =========================================================================
     */


    async traceOperation(

        operationName,

        operation,

        context = {}

    ) {


        return this.trace(

            `transaction.${operationName}`,

            operation,

            {


                transactionId:

                    context.transactionId,



                tenantId:

                    context.tenantId,



                provider:

                    context.provider,



                operation:

                    operationName


            }

        );


    }



    /**
     * =========================================================================
     * Provider Call Trace
     * =========================================================================
     */


    async traceProviderCall(

        provider,

        operation,

        callback,

        context = {}

    ) {


        return this.trace(

            `provider.${provider}.${operation}`,

            callback,

            {


                provider,



                operation,



                transactionId:

                    context.transactionId



            }

        );


    }



    /**
     * =========================================================================
     * Error Recording
     * =========================================================================
     */


    recordError(span, error) {


        if (!span) {

            return;

        }



        span.status =

            SpanStatus.ERROR;



        span.error = {


            name:

                error.name,



            message:

                error.message,



            code:

                error.code



        };



        if (

            span.otelSpan

        ) {


            span.otelSpan.recordException(

                error

            );


        }


    }



    /**
     * =========================================================================
     * Add Attribute
     * =========================================================================
     */


    addAttribute(span, key, value) {


        if (!span) {

            return;

        }



        span.attributes[key] = value;



        span.otelSpan?.setAttribute?.(

            key,

            value

        );


    }



    /**
     * =========================================================================
     * Add Event
     * =========================================================================
     */


    addEvent(span, name, attributes = {}) {


        if (!span) {

            return;

        }



        span.events =

            span.events || [];



        span.events.push({


            name,


            attributes,


            timestamp:

                new Date()


        });



        span.otelSpan?.addEvent?.(

            name,

            attributes

        );


    }



    /**
     * =========================================================================
     * Trace Context Propagation
     * =========================================================================
     */


    getContext(span) {


        if (!span) {


            return null;

        }



        return {


            traceId:

                span.traceId,



            spanId:

                span.id



        };


    }



    /**
     * =========================================================================
     * Attribute Builder
     * =========================================================================
     */


    buildAttributes(attributes) {


        return {


            service:

                this.serviceName,



            environment:

                this.environment,



            ...attributes


        };


    }



    /**
     * =========================================================================
     * Active Traces
     * =========================================================================
     */


    getActiveSpans() {


        return Array.from(

            this.activeSpans.values()

        );


    }



    /**
     * =========================================================================
     * Statistics
     * =========================================================================
     */


    getStatistics() {


        return {


            ...this.statistics,



            active:

                this.activeSpans.size


        };


    }



    /**
     * =========================================================================
     * Shutdown
     * =========================================================================
     */


    shutdown() {


        for (

            const span of this.activeSpans.values()

        ) {


            this.endSpan(

                span

            );


        }



        this.activeSpans.clear();


    }


}



TransactionTracer.Status = SpanStatus;


module.exports = TransactionTracer;