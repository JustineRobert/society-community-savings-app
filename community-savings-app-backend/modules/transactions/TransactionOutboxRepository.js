'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Transaction Outbox Repository
 * ============================================================================
 *
 * Responsibilities:
 *
 * - Durable outbox persistence
 * - Atomic event insertion
 * - Pending event retrieval
 * - Distributed locking
 * - Optimistic concurrency
 * - Publish state transitions
 * - Retry persistence
 * - Dead-letter handling
 *
 * Database:
 *
 * Primary:
 * - MongoDB / Mongoose
 *
 * Compatible:
 * - PostgreSQL adapter can implement same contract
 *
 * ============================================================================
 */


const {
    EventStatus
} = require('./TransactionOutboxModel');



class TransactionOutboxRepository {


    constructor(options = {}) {


        this.model =

            options.model;



        this.logger =

            options.logger || console;



        this.metrics =

            options.metrics || null;



        this.clock =

            options.clock || Date;



        this.lockTimeoutMs =

            options.lockTimeoutMs || 30000;



        this.maxRetryAttempts =

            options.maxRetryAttempts || 10;


    }





    /**
     * =========================================================================
     * Atomic Event Insert
     * =========================================================================
     *
     * Writes event to outbox.
     *
     * Should execute inside same DB transaction as business operation.
     *
     */


    async create(record, session = null) {


        const document =

            new this.model(record);



        await document.save({

            session

        });



        return document.toObject();


    }





    /**
     * =========================================================================
     * Find Pending Events
     * =========================================================================
     *
     * Retrieves events ready for publishing.
     *
     */


    async findPending(limit = 100) {


        const now =

            new this.clock();



        return this.model.find({

            status:

                EventStatus.PENDING,



            availableAt:

                {

                    $lte:

                        now

                }


        })

        .sort({

            createdAt:

                1

        })

        .limit(limit)

        .lean();


    }





    /**
     * =========================================================================
     * Acquire Event Lock
     * =========================================================================
     *
     * Prevents multiple publishers processing same event.
     *
     */


    async acquireLock(id, workerId) {


        const now =

            new this.clock();



        const expiredLock =

            new Date(

                now.getTime()

                -

                this.lockTimeoutMs

            );



        const result =

            await this.model.findOneAndUpdate(


                {


                    id,



                    $or:

                    [


                        {

                            status:

                                EventStatus.PENDING

                        },


                        {


                            lockedAt:

                                {

                                    $lt:

                                        expiredLock

                                }


                        }


                    ]

                },



                {


                    $set:

                    {


                        status:

                            EventStatus.PROCESSING,



                        lockedAt:

                            now,



                        lockedBy:

                            workerId,


                        updatedAt:

                            now


                    }


                },



                {


                    new:

                        true


                }


            );



        return result;


    }





    /**
     * =========================================================================
     * Mark Published
     * =========================================================================
     */


    async markPublished(id) {


        return this.model.findOneAndUpdate(


            {


                id,



                status:

                    EventStatus.PROCESSING


            },


            {


                $set:

                {


                    status:

                        EventStatus.PUBLISHED,



                    publishedAt:

                        new this.clock(),



                    updatedAt:

                        new this.clock()


                }


            },


            {

                new:

                    true

            }


        );


    }





    /**
     * =========================================================================
     * Persist Failure + Retry
     * =========================================================================
     */


    async markFailed(
        id,
        error
    ) {


        const record =

            await this.model.findOne({

                id

            });



        if (!record) {


            return null;


        }



        const attempts =

            record.attempts + 1;



        const exhausted =

            attempts >= this.maxRetryAttempts;



        return this.model.findOneAndUpdate(


            {

                id


            },



            {


                $set:

                {


                    status:

                        exhausted

                            ? EventStatus.DEAD_LETTER

                            : EventStatus.PENDING,



                    lastError:

                        {


                            message:

                                error.message,



                            stack:

                                error.stack || null,



                            occurredAt:

                                new this.clock()


                        },



                    availableAt:

                        exhausted

                            ? null

                            : calculateRetryTime(attempts),



                    updatedAt:

                        new this.clock()


                },



                $inc:

                {


                    attempts:

                        1


                }


            },

            {

                new:

                    true

            }


        );


    }





    /**
     * =========================================================================
     * Dead Letter Retrieval
     * =========================================================================
     */


    async findDeadLetters(limit = 100) {


        return this.model.find({

            status:

                EventStatus.DEAD_LETTER


        })

        .sort({

            updatedAt:

                -1

        })

        .limit(limit)

        .lean();


    }





    /**
     * =========================================================================
     * Restore Dead Letter
     * =========================================================================
     */


    async retryDeadLetter(id) {


        return this.model.findOneAndUpdate(


            {

                id,



                status:

                    EventStatus.DEAD_LETTER


            },



            {


                $set:

                {


                    status:

                        EventStatus.PENDING,



                    attempts:

                        0,



                    availableAt:

                        new this.clock(),



                    updatedAt:

                        new this.clock()


                }


            },

            {

                new:

                    true

            }


        );


    }





    /**
     * =========================================================================
     * Delete Published Events
     * =========================================================================
     */


    async removePublished(beforeDate) {


        return this.model.deleteMany({


            status:

                EventStatus.PUBLISHED,



            publishedAt:

                {

                    $lt:

                        beforeDate

                }


        });


    }


}





/**
 * ============================================================================
 * Retry Backoff
 * ============================================================================
 */


function calculateRetryTime(attempt) {


    const delay =

        Math.min(

            60000,

            Math.pow(

                2,

                attempt

            )

            *

            1000

        );



    return new Date(

        Date.now()

        +

        delay

    );


}





module.exports = TransactionOutboxRepository;