'use strict';

/**
 * ==========================================================
 * TITech Community Capital LTD
 * Airtel Money Enterprise Authentication Observability
 * ----------------------------------------------------------
 * Enterprise observability layer for Airtel OAuth lifecycle.
 *
 * Responsibilities
 * ----------------
 * • Authentication telemetry
 * • Token lifecycle metrics
 * • Refresh monitoring
 * • Provider health tracking
 * • Structured event generation
 * • OpenTelemetry span helpers
 * • Prometheus metric hooks
 * • Failure analytics
 * • SLA monitoring hooks
 * • Operational diagnostics
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Authentication execution
 * • OAuth transport
 * • Credential management
 * • Token persistence
 *
 * ==========================================================
 */


const crypto = require('crypto');



const EVENT_TYPES = Object.freeze({

    AUTH_STARTED:
        'AIRTEL_AUTH_STARTED',

    AUTH_SUCCESS:
        'AIRTEL_AUTH_SUCCESS',

    AUTH_FAILURE:
        'AIRTEL_AUTH_FAILURE',

    TOKEN_REFRESH_STARTED:
        'AIRTEL_TOKEN_REFRESH_STARTED',

    TOKEN_REFRESH_SUCCESS:
        'AIRTEL_TOKEN_REFRESH_SUCCESS',

    TOKEN_REFRESH_FAILURE:
        'AIRTEL_TOKEN_REFRESH_FAILURE'

});







class AirtelAuthObservability {


    constructor({

        logger,

        metrics,

        tracer,

        eventBus,

        auditService,

        serviceName =
            'airtel-auth-service'


    } = {}) {



        this.logger =
            logger;


        this.metrics =
            metrics;


        this.tracer =
            tracer;


        this.eventBus =
            eventBus;


        this.auditService =
            auditService;


        this.serviceName =
            serviceName;






        this.startedAt =
            new Date();





        this.statistics = {


            authenticationStarted:
                0,


            authenticationSucceeded:
                0,


            authenticationFailed:
                0,


            refreshStarted:
                0,


            refreshSucceeded:
                0,


            refreshFailed:
                0


        };



    }









    /**
     * ------------------------------------------------------
     * Authentication Started
     * ------------------------------------------------------
     */
    authenticationStarted({

        tenantId,

        correlationId = crypto.randomUUID()


    }) {



        this.statistics.authenticationStarted++;





        this.metrics?.counter?.(

            'payment_airtel_auth_started_total'

        );





        this.emit({

            type:

                EVENT_TYPES.AUTH_STARTED,


            tenantId,


            correlationId


        });


    }









    /**
     * ------------------------------------------------------
     * Authentication Success
     * ------------------------------------------------------
     */
    authenticationSucceeded({

        tenantId,

        correlationId


    }) {



        this.statistics.authenticationSucceeded++;





        this.metrics?.counter?.(

            'payment_airtel_auth_success_total'

        );






        this.emit({

            type:

                EVENT_TYPES.AUTH_SUCCESS,


            tenantId,


            correlationId


        });


    }









    /**
     * ------------------------------------------------------
     * Authentication Failure
     * ------------------------------------------------------
     */
    authenticationFailed({

        tenantId,

        correlationId,

        error


    }) {



        this.statistics.authenticationFailed++;





        this.metrics?.counter?.(

            'payment_airtel_auth_failure_total'

        );







        this.logger?.error?.({

            message:

                'Airtel authentication failed',


            tenantId,


            correlationId,


            error:

                error?.toJSON?.()

                ||

                error


        });






        this.emit({

            type:

                EVENT_TYPES.AUTH_FAILURE,


            tenantId,


            correlationId,


            error


        });


    }









    /**
     * ------------------------------------------------------
     * Refresh Started
     * ------------------------------------------------------
     */
    refreshStarted({

        tenantId,

        correlationId = crypto.randomUUID()


    }) {



        this.statistics.refreshStarted++;





        this.metrics?.counter?.(

            'payment_airtel_token_refresh_started_total'

        );





        this.emit({

            type:

                EVENT_TYPES.TOKEN_REFRESH_STARTED,


            tenantId,


            correlationId


        });


    }









    /**
     * ------------------------------------------------------
     * Refresh Success
     * ------------------------------------------------------
     */
    refreshSucceeded({

        tenantId,

        correlationId


    }) {



        this.statistics.refreshSucceeded++;





        this.metrics?.counter?.(

            'payment_airtel_token_refresh_success_total'

        );





        this.emit({

            type:

                EVENT_TYPES.TOKEN_REFRESH_SUCCESS,


            tenantId,


            correlationId


        });


    }









    /**
     * ------------------------------------------------------
     * Refresh Failure
     * ------------------------------------------------------
     */
    refreshFailed({

        tenantId,

        correlationId,

        error


    }) {



        this.statistics.refreshFailed++;





        this.metrics?.counter?.(

            'payment_airtel_token_refresh_failure_total'

        );







        this.logger?.error?.({

            message:

                'Airtel token refresh failed',


            tenantId,


            correlationId,


            error:

                error?.toJSON?.()

                ||

                error


        });







        this.emit({

            type:

                EVENT_TYPES.TOKEN_REFRESH_FAILURE,


            tenantId,


            correlationId,


            error


        });


    }









    /**
     * ------------------------------------------------------
     * Span Creation Helper
     * ------------------------------------------------------
     */
    startSpan(name, attributes = {}){



        const span =

            this.tracer?.startSpan?.(

                name

            );





        Object.entries(attributes)

            .forEach(([key,value]) => {



                span?.setAttribute?.(

                    key,

                    value

                );


            });






        return span;


    }









    /**
     * ------------------------------------------------------
     * Provider Health Snapshot
     * ------------------------------------------------------
     */
    health(){



        return {


            provider:

                'AIRTEL',


            service:

                this.serviceName,


            status:

                'UP',


            startedAt:

                this.startedAt,


            uptimeMs:

                Date.now()

                -

                this.startedAt.getTime(),


            statistics:

                {

                    ...this.statistics

                }


        };


    }









    /**
     * ------------------------------------------------------
     * Emit Observability Event
     * ------------------------------------------------------
     */
    emit(payload){



        const event = {


            ...payload,


            service:

                this.serviceName,


            timestamp:

                new Date()


        };







        this.eventBus?.publish?.(

            event

        );







        this.auditService?.record?.(

            {

                action:

                    payload.type,


                metadata:

                    event

            }

        );



    }









    /**
     * ------------------------------------------------------
     * Diagnostics Snapshot
     * ------------------------------------------------------
     */
    snapshot(){



        return {


            service:

                this.serviceName,


            statistics:

                {

                    ...this.statistics

                },


            generatedAt:

                new Date()


        };


    }



}





module.exports = {

    AirtelAuthObservability,

    EVENT_TYPES

};