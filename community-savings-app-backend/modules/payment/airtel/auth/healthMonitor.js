'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Airtel Money Authentication Health Monitor
 * ============================================================================
 *
 * Purpose
 * -------
 * Production-grade health orchestration service for the Airtel Money
 * authentication subsystem.
 *
 * Responsibilities
 * ----------------
 * • Authentication subsystem monitoring
 * • OAuth dependency verification
 * • Credential subsystem validation
 * • Token cache health analysis
 * • Dependency aggregation
 * • Kubernetes readiness support
 * • Kubernetes liveness support
 * • Startup diagnostics
 * • SLA monitoring hooks
 * • Metrics publication
 * • Structured operational logging
 * • Event publishing
 * • OpenTelemetry instrumentation
 * • Failure diagnostics
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Authentication execution
 * • OAuth transport
 * • Token issuance
 * • Credential storage
 * • Payment processing
 *
 * ============================================================================
 */


const crypto = require('crypto');




const HEALTH_STATUS = Object.freeze({

    UP: 'UP',

    DOWN: 'DOWN',

    DEGRADED: 'DEGRADED',

    UNKNOWN: 'UNKNOWN'

});







class HealthMonitor {


    constructor({

        authService,

        oauthClient,

        tokenManager,

        credentialManager,

        configuration,

        logger,

        metrics,

        tracer,

        eventBus,

        alertService


    } = {}) {



        this.authService =
            authService;


        this.oauthClient =
            oauthClient;


        this.tokenManager =
            tokenManager;


        this.credentialManager =
            credentialManager;


        this.configuration =
            configuration;


        this.logger =
            logger;


        this.metrics =
            metrics;


        this.tracer =
            tracer;


        this.eventBus =
            eventBus;


        this.alertService =
            alertService;





        this.startedAt =
            new Date();





        this.lastHealthCheck =
            null;


        this.lastSuccessfulCheck =
            null;


        this.failureCount =
            0;




        this.statistics = {


            checks:
                0,


            successful:
                0,


            failed:
                0


        };



    }









    /**
     * ------------------------------------------------------------------------
     * Full Authentication Health Assessment
     * ------------------------------------------------------------------------
     */
    async check({

        tenantId = null,

        correlationId =
            crypto.randomUUID()


    } = {}) {



        const span =

            this.tracer?.startSpan?.(

                'airtel.auth.health.check'

            );





        const started =

            Date.now();






        this.statistics.checks++;






        try {



            const checks = {


                configuration:

                    await this.checkConfiguration(),



                credentials:

                    await this.checkCredentials(

                        tenantId

                    ),



                tokenManager:

                    await this.checkTokenManager(),



                oauth:

                    await this.checkOAuth(),



                authentication:

                    await this.checkAuthentication()


            };







            const status =

                this.calculateStatus(

                    checks

                );







            const report = {


                provider:

                    'AIRTEL',



                component:

                    'authentication',



                status,



                timestamp:

                    new Date(),



                correlationId,



                uptimeMs:

                    Date.now()

                    -

                    this.startedAt.getTime(),



                durationMs:

                    Date.now()

                    -

                    started,



                checks


            };







            this.lastHealthCheck =
                report;






            if(status === HEALTH_STATUS.UP){



                this.lastSuccessfulCheck =

                    report.timestamp;



                this.statistics.successful++;



            }

            else {



                this.failureCount++;



                this.statistics.failed++;



            }







            this.publishMetrics(

                report

            );






            this.publishEvent(

                report

            );







            if(status !== HEALTH_STATUS.UP){



                await this.triggerAlert(

                    report

                );


            }






            return report;




        }

        catch(error){



            this.statistics.failed++;



            this.failureCount++;






            this.logger?.error?.({

                message:

                    'Airtel authentication health evaluation failed',


                correlationId,


                error:

                    error.message


            });







            return {


                provider:

                    'AIRTEL',



                component:

                    'authentication',



                status:

                    HEALTH_STATUS.DOWN,



                correlationId,



                timestamp:

                    new Date(),



                error:

                    error.message


            };



        }


        finally {



            span?.end?.();


        }


    }









    /**
     * ------------------------------------------------------------------------
     * Kubernetes Readiness Probe
     * ------------------------------------------------------------------------
     */
    async readiness(){



        const result =

            await this.check();






        return {


            ready:

                result.status === HEALTH_STATUS.UP,



            status:

                result.status,



            timestamp:

                result.timestamp


        };


    }









    /**
     * ------------------------------------------------------------------------
     * Kubernetes Liveness Probe
     * ------------------------------------------------------------------------
     */
    async liveness(){



        return {


            alive:

                true,



            provider:

                'AIRTEL',



            component:

                'authentication',



            uptimeMs:

                Date.now()

                -

                this.startedAt.getTime(),



            timestamp:

                new Date()


        };


    }









    /**
     * ------------------------------------------------------------------------
     * Configuration Check
     * ------------------------------------------------------------------------
     */
    async checkConfiguration(){



        try {



            this.configuration?.validate?.();






            return {


                status:

                    HEALTH_STATUS.UP


            };



        }

        catch(error){



            return {


                status:

                    HEALTH_STATUS.DOWN,



                error:

                    error.message


            };


        }


    }









    /**
     * ------------------------------------------------------------------------
     * Credential Validation
     * ------------------------------------------------------------------------
     */
    async checkCredentials(

        tenantId

    ){



        if(!this.credentialManager){



            return {


                status:

                    HEALTH_STATUS.UNKNOWN


            };


        }







        try {



            if(tenantId){



                await this.credentialManager.resolve({

                    tenantId

                });


            }






            return {


                status:

                    HEALTH_STATUS.UP


            };



        }

        catch(error){



            return {


                status:

                    HEALTH_STATUS.DOWN,



                error:

                    error.message


            };


        }


    }









    /**
     * ------------------------------------------------------------------------
     * Token Manager Check
     * ------------------------------------------------------------------------
     */
    async checkTokenManager(){



        if(!this.tokenManager){



            return {


                status:

                    HEALTH_STATUS.UNKNOWN


            };


        }






        try {



            return {


                status:

                    HEALTH_STATUS.UP,



                cacheEntries:

                    this.tokenManager.size?.(),



                statistics:

                    this.tokenManager.stats?.()


            };



        }

        catch(error){



            return {


                status:

                    HEALTH_STATUS.DOWN,



                error:

                    error.message


            };


        }


    }









    /**
     * ------------------------------------------------------------------------
     * OAuth Dependency Check
     * ------------------------------------------------------------------------
     */
    async checkOAuth(){



        if(!this.oauthClient){



            return {


                status:

                    HEALTH_STATUS.UNKNOWN


            };


        }







        try {



            if(

                typeof this.oauthClient.health ===

                'function'

            ){



                return await this.oauthClient.health();


            }






            return {


                status:

                    HEALTH_STATUS.UP


            };



        }

        catch(error){



            return {


                status:

                    HEALTH_STATUS.DOWN,



                error:

                    error.message


            };


        }


    }









    /**
     * ------------------------------------------------------------------------
     * Authentication Service Check
     * ------------------------------------------------------------------------
     */
    async checkAuthentication(){



        if(!this.authService){



            return {


                status:

                    HEALTH_STATUS.UNKNOWN


            };


        }







        try {



            if(

                typeof this.authService.health ===

                'function'

            ){



                return await this.authService.health();


            }






            return {


                status:

                    HEALTH_STATUS.UP


            };



        }

        catch(error){



            return {


                status:

                    HEALTH_STATUS.DOWN,



                error:

                    error.message


            };


        }


    }









    /**
     * ------------------------------------------------------------------------
     * Status Aggregation
     * ------------------------------------------------------------------------
     */
    calculateStatus(checks){



        const statuses =

            Object.values(checks)

                .map(

                    item => item.status

                );






        if(

            statuses.includes(

                HEALTH_STATUS.DOWN

            )

        ){

            return HEALTH_STATUS.DOWN;

        }







        if(

            statuses.includes(

                HEALTH_STATUS.UNKNOWN

            )

        ){

            return HEALTH_STATUS.DEGRADED;

        }






        return HEALTH_STATUS.UP;


    }









    /**
     * ------------------------------------------------------------------------
     * Metrics
     * ------------------------------------------------------------------------
     */
    publishMetrics(report){



        this.metrics?.gauge?.(

            'payment_airtel_auth_health',

            report.status === HEALTH_STATUS.UP

                ? 1

                : 0

        );






        this.metrics?.histogram?.(

            'payment_airtel_auth_health_duration_ms',

            report.durationMs

        );



    }









    /**
     * ------------------------------------------------------------------------
     * Event Publishing
     * ------------------------------------------------------------------------
     */
    publishEvent(report){



        this.eventBus?.publish?.({

            type:

                'AIRTEL_AUTH_HEALTH_STATUS_CHANGED',



            payload:

                report


        });


    }









    /**
     * ------------------------------------------------------------------------
     * Alert Hook
     * ------------------------------------------------------------------------
     */
    async triggerAlert(report){



        await this.alertService?.notify?.({

            service:

                'airtel-auth',



            severity:

                'WARNING',



            report


        });


    }









    /**
     * ------------------------------------------------------------------------
     * Runtime Snapshot
     * ------------------------------------------------------------------------
     */
    snapshot(){



        return {


            provider:

                'AIRTEL',



            component:

                'authentication',



            startedAt:

                this.startedAt,



            uptimeMs:

                Date.now()

                -

                this.startedAt.getTime(),



            lastHealthCheck:

                this.lastHealthCheck?.timestamp

                ||

                null,



            lastSuccessfulCheck:

                this.lastSuccessfulCheck,



            failureCount:

                this.failureCount,



            statistics:

                {

                    ...this.statistics

                }


        };


    }



}





module.exports = {

    HealthMonitor,

    HEALTH_STATUS

};