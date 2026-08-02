'use strict';

/**
 * ==========================================================
 * TITech Community Capital LTD
 * Airtel Money Enterprise Refresh Manager
 * ----------------------------------------------------------
 * Enterprise OAuth token refresh coordination service.
 *
 * Responsibilities
 * ----------------
 * • Single-flight token refresh
 * • Concurrent refresh prevention
 * • Tenant-isolated refresh locks
 * • Refresh retry orchestration
 * • Exponential backoff
 * • Failure classification
 * • Metrics instrumentation
 * • Distributed tracing hooks
 * • Structured logging
 * • Refresh analytics
 * • Graceful failure handling
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • OAuth HTTP communication
 * • Token storage
 * • Credential resolution
 * • Payment processing
 *
 * ==========================================================
 */


const crypto = require('crypto');


const {
    normalizeError
} = require('../../shared/errors');



const REFRESH_STATUS = Object.freeze({

    IDLE: 'IDLE',

    RUNNING: 'RUNNING',

    FAILED: 'FAILED',

    SUCCESS: 'SUCCESS'

});







class RefreshManager {


    constructor({

        logger,

        metrics,

        tracer,

        maxRetries = 3,

        initialDelayMs = 500,

        maxDelayMs = 10000,

        backoffMultiplier = 2,

        clock = Date


    } = {}) {



        this.logger =
            logger;


        this.metrics =
            metrics;


        this.tracer =
            tracer;


        this.maxRetries =
            maxRetries;


        this.initialDelayMs =
            initialDelayMs;


        this.maxDelayMs =
            maxDelayMs;


        this.backoffMultiplier =
            backoffMultiplier;


        this.clock =
            clock;





        /**
         * tenantId -> Promise
         *
         * Prevents refresh storms
         */
        this.refreshLocks =
            new Map();





        this.refreshState =
            new Map();





        this.statistics = {


            attempts: 0,


            successful: 0,


            failed: 0,


            deduplicated: 0,


            retries: 0


        };



    }









    /**
     * ------------------------------------------------------
     * Execute Refresh
     * ------------------------------------------------------
     */
    async execute({

        tenantId,

        refresh,

        correlationId = crypto.randomUUID()


    }) {



        if(!tenantId){

            throw new Error(

                'tenantId required'

            );

        }






        const existing =

            this.refreshLocks.get(

                tenantId

            );






        if(existing){



            this.statistics.deduplicated++;



            this.metrics?.counter?.(

                'payment_airtel_refresh_deduplicated_total'

            );



            return existing;


        }









        const operation =

            this.runRefresh({

                tenantId,

                refresh,

                correlationId

            });







        this.refreshLocks.set(

            tenantId,

            operation

        );





        try {


            return await operation;


        }


        finally {


            this.refreshLocks.delete(

                tenantId

            );


        }


    }









    /**
     * ------------------------------------------------------
     * Refresh Executor
     * ------------------------------------------------------
     */
    async runRefresh({

        tenantId,

        refresh,

        correlationId


    }) {



        const span =

            this.tracer?.startSpan?.(

                'airtel.oauth.refresh'

            );




        try {



            this.statistics.attempts++;





            this.setState(

                tenantId,

                REFRESH_STATUS.RUNNING

            );







            const result =

                await this.executeWithRetry({

                    operation:

                        refresh,


                    tenantId,


                    correlationId


                });








            this.statistics.successful++;





            this.setState(

                tenantId,

                REFRESH_STATUS.SUCCESS

            );







            this.metrics?.counter?.(

                'payment_airtel_refresh_success_total'

            );







            this.logger?.info?.({

                message:

                    'Airtel token refresh successful',


                tenantId,


                correlationId


            });








            return result;



        }


        catch(error){



            this.statistics.failed++;





            this.setState(

                tenantId,

                REFRESH_STATUS.FAILED

            );







            this.metrics?.counter?.(

                'payment_airtel_refresh_failed_total'

            );







            this.logger?.error?.({

                message:

                    'Airtel token refresh failed',


                tenantId,


                correlationId,


                error:

                    error.toJSON?.()

                    ||

                    error


            });







            throw normalizeError(error);



        }


        finally{


            span?.end?.();


        }


    }









    /**
     * ------------------------------------------------------
     * Retry Execution
     * ------------------------------------------------------
     */
    async executeWithRetry({

        operation,

        tenantId,

        correlationId


    }) {



        let attempt = 0;

        let lastError;







        while(attempt < this.maxRetries){



            try {


                return await operation();


            }


            catch(error){



                lastError = error;


                attempt++;






                if(

                    attempt >= this.maxRetries

                ){

                    break;

                }






                this.statistics.retries++;





                const delay =

                    Math.min(

                        this.initialDelayMs *

                        Math.pow(

                            this.backoffMultiplier,

                            attempt - 1

                        ),

                        this.maxDelayMs

                    );







                this.logger?.warn?.({

                    message:

                        'Retrying Airtel token refresh',


                    tenantId,


                    attempt,


                    delay,


                    correlationId


                });








                await this.sleep(delay);



            }


        }






        throw lastError;


    }









    /**
     * ------------------------------------------------------
     * Refresh Status
     * ------------------------------------------------------
     */
    getStatus(tenantId){



        return this.refreshState.get(

            tenantId

        )

        ||

        {


            status:

                REFRESH_STATUS.IDLE


        };


    }









    /**
     * ------------------------------------------------------
     * State Update
     * ------------------------------------------------------
     */
    setState(

        tenantId,

        status

    ){



        this.refreshState.set(

            tenantId,

            {

                status,


                updatedAt:

                    new this.clock()


            }


        );


    }









    /**
     * ------------------------------------------------------
     * Is Refresh Running
     * ------------------------------------------------------
     */
    isRefreshing(tenantId){



        return this.refreshLocks.has(

            tenantId

        );


    }









    /**
     * ------------------------------------------------------
     * Statistics
     * ------------------------------------------------------
     */
    stats(){



        return {


            ...this.statistics,


            activeRefreshes:

                this.refreshLocks.size


        };


    }









    /**
     * ------------------------------------------------------
     * Health
     * ------------------------------------------------------
     */
    health(){



        return {


            provider:

                'AIRTEL',


            status:

                'UP',


            activeRefreshes:

                this.refreshLocks.size,


            statistics:

                this.stats()


        };


    }









    /**
     * ------------------------------------------------------
     * Shutdown
     * ------------------------------------------------------
     */
    async shutdown(){



        this.refreshLocks.clear();



        this.refreshState.clear();




        return true;


    }









    sleep(ms){



        return new Promise(

            resolve =>

                setTimeout(

                    resolve,

                    ms

                )

        );


    }



}




module.exports = {

    RefreshManager,

    REFRESH_STATUS

};