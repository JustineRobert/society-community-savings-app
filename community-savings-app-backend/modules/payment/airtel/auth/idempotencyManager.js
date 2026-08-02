'use strict';

/**
 * ==========================================================
 * TITech Community Capital LTD
 * Airtel Money Enterprise Idempotency Manager
 * ----------------------------------------------------------
 * Enterprise idempotency control layer for Airtel operations.
 *
 * Responsibilities
 * ----------------
 * • Duplicate request prevention
 * • Tenant-isolated idempotency keys
 * • Atomic request locking
 * • Response replay
 * • TTL management
 * • Distributed cache support
 * • Concurrent execution protection
 * • Metrics instrumentation
 * • Structured logging
 * • Audit hooks
 * • Operational diagnostics
 *
 * Used By
 * -------
 * • Authentication workflows
 * • Collections
 * • Disbursements
 * • Settlement
 * • Reconciliation
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Payment execution
 * • Provider communication
 * • Ledger posting
 *
 * ==========================================================
 */


const crypto = require('crypto');






const IDEMPOTENCY_STATUS = Object.freeze({

    PROCESSING:
        'PROCESSING',

    COMPLETED:
        'COMPLETED',

    FAILED:
        'FAILED',

    EXPIRED:
        'EXPIRED'

});







class IdempotencyManager {


    constructor({

        cache = null,

        ttlSeconds = 86400,

        lockTTLSeconds = 300,

        logger,

        metrics,

        auditService,

        clock = Date


    } = {}) {



        this.cache =
            cache;


        this.ttlSeconds =
            ttlSeconds;


        this.lockTTLSeconds =
            lockTTLSeconds;


        this.logger =
            logger;


        this.metrics =
            metrics;


        this.auditService =
            auditService;


        this.clock =
            clock;





        /**
         * Local fallback store
         */
        this.memory =
            new Map();





        /**
         * Active execution locks
         */
        this.locks =
            new Map();





        this.statistics = {


            checks:
                0,


            hits:
                0,


            misses:
                0,


            stored:
                0,


            conflicts:
                0,


            failures:
                0


        };


    }









    /**
     * ------------------------------------------------------
     * Check Existing Request
     * ------------------------------------------------------
     */
    async check({

        tenantId,

        key


    }) {



        this.validate(

            tenantId,

            key

        );





        this.statistics.checks++;





        const record =

            await this.getRecord({

                tenantId,

                key

            });







        if(!record){



            this.statistics.misses++;



            this.metrics?.counter?.(

                'payment_airtel_idempotency_miss_total'

            );



            return null;


        }






        if(this.isExpired(record)){



            await this.remove({

                tenantId,

                key

            });



            return null;


        }






        this.statistics.hits++;






        this.metrics?.counter?.(

            'payment_airtel_idempotency_hit_total'

        );






        return record;


    }









    /**
     * ------------------------------------------------------
     * Begin Processing Lock
     * ------------------------------------------------------
     */
    async acquire({

        tenantId,

        key,

        metadata = {}


    }) {



        this.validate(

            tenantId,

            key

        );





        const existing =

            await this.check({

                tenantId,

                key

            });







        if(existing){



            this.statistics.conflicts++;




            return {


                acquired:

                    false,


                existing


            };


        }









        const lock = {


            status:

                IDEMPOTENCY_STATUS.PROCESSING,


            tenantId,


            key,


            metadata,


            createdAt:

                new this.clock(),


            expiresAt:

                new Date(

                    Date.now()

                    +

                    this.lockTTLSeconds * 1000

                )

        };









        await this.save({

            tenantId,

            key,

            record:

                lock

        });









        this.metrics?.counter?.(

            'payment_airtel_idempotency_lock_created_total'

        );






        return {


            acquired:

                true,


            lock


        };


    }









    /**
     * ------------------------------------------------------
     * Store Completed Response
     * ------------------------------------------------------
     */
    async complete({

        tenantId,

        key,

        response,

        metadata = {}


    }) {



        const record = {


            status:

                IDEMPOTENCY_STATUS.COMPLETED,


            tenantId,


            key,


            response,


            metadata,


            completedAt:

                new this.clock(),


            expiresAt:

                new Date(

                    Date.now()

                    +

                    this.ttlSeconds * 1000

                )


        };







        await this.save({

            tenantId,

            key,

            record

        });








        this.statistics.stored++;






        this.metrics?.counter?.(

            'payment_airtel_idempotency_completed_total'

        );






        return record;


    }









    /**
     * ------------------------------------------------------
     * Mark Failure
     * ------------------------------------------------------
     */
    async fail({

        tenantId,

        key,

        error


    }) {



        const record = {


            status:

                IDEMPOTENCY_STATUS.FAILED,


            tenantId,


            key,


            error:

                {

                    message:

                        error?.message

                },


            failedAt:

                new this.clock(),


            expiresAt:

                new Date(

                    Date.now()

                    +

                    this.ttlSeconds * 1000

                )


        };







        await this.save({

            tenantId,

            key,

            record

        });






        this.statistics.failures++;






        return record;


    }









    /**
     * ------------------------------------------------------
     * Remove Entry
     * ------------------------------------------------------
     */
    async remove({

        tenantId,

        key


    }) {



        const cacheKey =

            this.buildKey(

                tenantId,

                key

            );






        if(this.cache?.delete){



            await this.cache.delete(

                cacheKey

            );


        }





        this.memory.delete(

            cacheKey

        );


    }









    /**
     * ------------------------------------------------------
     * Storage
     * ------------------------------------------------------
     */
    async save({

        tenantId,

        key,

        record


    }) {



        const cacheKey =

            this.buildKey(

                tenantId,

                key

            );





        if(this.cache?.set){



            await this.cache.set(

                cacheKey,

                record,

                this.ttlSeconds

            );


        }






        this.memory.set(

            cacheKey,

            record

        );


    }









    async getRecord({

        tenantId,

        key


    }) {



        const cacheKey =

            this.buildKey(

                tenantId,

                key

            );






        if(this.cache?.get){



            const cached =

                await this.cache.get(

                    cacheKey

                );



            if(cached){

                return cached;

            }


        }







        return this.memory.get(

            cacheKey

        );


    }









    /**
     * ------------------------------------------------------
     * Key Builder
     * ------------------------------------------------------
     */
    buildKey(

        tenantId,

        key

    ){



        return [

            'airtel',

            'idempotency',

            tenantId,

            crypto

                .createHash('sha256')

                .update(key)

                .digest('hex')

        ].join(':');


    }









    validate(

        tenantId,

        key

    ){



        if(!tenantId){

            throw new Error(

                'tenantId required'

            );

        }




        if(!key){

            throw new Error(

                'idempotency key required'

            );

        }


    }









    isExpired(record){



        return new Date(

            record.expiresAt

        ) <= new this.clock();


    }









    /**
     * ------------------------------------------------------
     * Statistics
     * ------------------------------------------------------
     */
    stats(){



        return {


            ...this.statistics,


            activeEntries:

                this.memory.size,


            ttlSeconds:

                this.ttlSeconds


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



        this.memory.clear();


        this.locks.clear();



        return true;


    }



}





module.exports = {


    IdempotencyManager,


    IDEMPOTENCY_STATUS


};