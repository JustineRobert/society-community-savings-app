'use strict';

/**
 * ==========================================================
 * TITech Community Capital LTD
 * Airtel Money Enterprise Token Manager
 * ----------------------------------------------------------
 * Centralized OAuth token lifecycle management.
 *
 * Responsibilities
 * ----------------
 * • Airtel OAuth token caching
 * • Tenant-isolated token storage
 * • Token expiration tracking
 * • Refresh window management
 * • Atomic token replacement
 * • Cache invalidation
 * • Token health monitoring
 * • Runtime statistics
 * • Secure token snapshots
 * • Metrics integration
 * • Structured logging
 * • Distributed cache compatibility hooks
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • OAuth authentication
 * • HTTP transport
 * • Credential management
 * • Payment processing
 * • Collections
 * • Disbursements
 *
 * ==========================================================
 */


const crypto = require('crypto');



const TOKEN_PROVIDER = 'AIRTEL';




class TokenManager {


    constructor({

        cache = null,

        refreshBufferSeconds = 120,

        logger,

        metrics,

        tracer,

        clock = Date


    } = {}) {



        this.cache =
            cache;


        this.refreshBufferMs =
            refreshBufferSeconds * 1000;


        this.logger =
            logger;


        this.metrics =
            metrics;


        this.tracer =
            tracer;


        this.clock =
            clock;





        /**
         * Local fallback cache
         *
         * Used when Redis/cache provider
         * is unavailable.
         */
        this.memoryCache =
            new Map();





        this.statistics = {


            hits: 0,


            misses: 0,


            stores: 0,


            removals: 0,


            expirations: 0,


            refreshes: 0


        };


    }









    /**
     * ------------------------------------------------------
     * Store Access Token
     * ------------------------------------------------------
     */
    async store({

        tenantId,

        token,

        correlationId = crypto.randomUUID()


    }) {



        if(!tenantId){

            throw new Error(

                'tenantId required'

            );

        }





        const now =

            new this.clock();





        const expiresIn =

            Number(

                token.expiresIn

                ||

                token.expires_in

                ||

                3600

            );





        const record = Object.freeze({



            tenantId,


            provider:

                TOKEN_PROVIDER,



            accessToken:

                token.accessToken

                ||

                token.access_token,



            tokenType:

                token.tokenType

                ||

                token.token_type

                ||

                'Bearer',



            expiresIn,



            createdAt:

                now,



            expiresAt:

                new Date(

                    now.getTime()

                    +

                    expiresIn * 1000

                ),



            correlationId


        });







        await this.write(

            tenantId,

            record

        );






        this.statistics.stores++;





        this.metrics?.counter?.(

            'payment_airtel_token_store_total'

        );






        this.logger?.info?.({

            message:

                'Airtel OAuth token stored',


            tenantId,


            expiresAt:

                record.expiresAt


        });






        return record;


    }









    /**
     * ------------------------------------------------------
     * Retrieve Token
     * ------------------------------------------------------
     */
    async get({

        tenantId


    }) {



        const token =

            await this.read(

                tenantId

            );






        if(!token){



            this.statistics.misses++;



            this.metrics?.counter?.(

                'payment_airtel_token_cache_miss_total'

            );



            return null;


        }








        if(this.isExpired(token)){



            await this.remove({

                tenantId

            });




            this.statistics.expirations++;




            return null;


        }








        this.statistics.hits++;






        this.metrics?.counter?.(

            'payment_airtel_token_cache_hit_total'

        );






        return token;


    }









    /**
     * ------------------------------------------------------
     * Replace Existing Token
     * ------------------------------------------------------
     */
    async replace({

        tenantId,

        token,

        correlationId


    }) {


        this.statistics.refreshes++;




        return this.store({

            tenantId,

            token,

            correlationId


        });


    }









    /**
     * ------------------------------------------------------
     * Remove Token
     * ------------------------------------------------------
     */
    async remove({

        tenantId


    }) {



        let removed = false;




        if(this.cache?.delete){



            removed =

                await this.cache.delete(

                    this.key(tenantId)

                );


        }






        removed =

            this.memoryCache.delete(

                tenantId

            )

            ||

            removed;







        if(removed){



            this.statistics.removals++;




            this.metrics?.counter?.(

                'payment_airtel_token_removed_total'

            );


        }




        return removed;


    }









    /**
     * ------------------------------------------------------
     * Expiration Checks
     * ------------------------------------------------------
     */
    isExpired(token){



        return (

            new this.clock()

        )

        >=

        new Date(

            token.expiresAt

        );


    }








    isExpiringSoon(token){



        const refreshPoint =


            new Date(

                token.expiresAt

            )

            .getTime()

            -

            this.refreshBufferMs;





        return Date.now() >= refreshPoint;


    }









    /**
     * ------------------------------------------------------
     * Token Extraction
     * ------------------------------------------------------
     */
    getAuthorizationHeader(token){



        if(!token){

            return null;

        }




        return `${token.tokenType} ${token.accessToken}`;


    }









    /**
     * ------------------------------------------------------
     * Cache Write
     * ------------------------------------------------------
     */
    async write(

        tenantId,

        value

    ){



        if(this.cache?.set){



            await this.cache.set(

                this.key(tenantId),

                value,

                value.expiresIn

            );


        }




        this.memoryCache.set(

            tenantId,

            value

        );


    }









    /**
     * ------------------------------------------------------
     * Cache Read
     * ------------------------------------------------------
     */
    async read(tenantId){



        if(this.cache?.get){



            const cached =

                await this.cache.get(

                    this.key(tenantId)

                );



            if(cached){

                return cached;

            }


        }






        return this.memoryCache.get(

            tenantId

        );


    }









    /**
     * ------------------------------------------------------
     * Clear Cache
     * ------------------------------------------------------
     */
    async clear(){



        this.memoryCache.clear();



        return true;


    }









    /**
     * ------------------------------------------------------
     * Cache Key
     * ------------------------------------------------------
     */
    key(tenantId){



        return `payment:${TOKEN_PROVIDER}:token:${tenantId}`;


    }









    /**
     * ------------------------------------------------------
     * Statistics
     * ------------------------------------------------------
     */
    stats(){



        return {


            ...this.statistics,


            cachedTokens:

                this.memoryCache.size,


            refreshBufferMs:

                this.refreshBufferMs


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

                TOKEN_PROVIDER,


            status:

                'UP',


            statistics:

                this.stats()


        };


    }









    /**
     * ------------------------------------------------------
     * Safe Snapshot
     * ------------------------------------------------------
     */
    snapshot(){



        return Array

            .from(this.memoryCache.values())

            .map(token => ({



                tenantId:

                    token.tenantId,



                provider:

                    token.provider,



                tokenType:

                    token.tokenType,



                expiresAt:

                    token.expiresAt,



                createdAt:

                    token.createdAt


            }));


    }


}





module.exports = TokenManager;