'use strict';


const crypto = require('crypto');



class TransactionPublishingEngine {


    constructor(options = {}) {


        this.repository =

            options.repository;



        this.router =

            options.router;



        this.eventBus =

            options.eventBus;



        this.logger =

            options.logger || console;



        this.metrics =

            options.metrics || null;



        this.batchSize =

            options.batchSize || 100;



        this.processedKeys =

            new Set();


    }





    /**
     * =========================================================================
     * Publish Pending Events
     * =========================================================================
     */


    async publishPending() {


        const events =

            await this.repository.findPending(

                this.batchSize

            );



        if (

            !events.length

        ) {


            return {


                published:

                    0


            };


        }



        const results = [];



        for (

            const record of events

        ) {


            results.push(

                await this.publishRecord(record)

            );


        }



        return {


            published:

                results.filter(Boolean).length


        };


    }





    /**
     * =========================================================================
     * Publish Single Record
     * =========================================================================
     */


    async publishRecord(record) {


        const event =

            record.event;



        const idempotencyKey =

            this.createIdempotencyKey(

                event

            );



        if (

            this.processedKeys.has(

                idempotencyKey

            )

        ) {


            return false;


        }





        const route =

            this.router.resolve(

                event

            );



        const message = {


            id:

                event.eventId,



            topic:

                route.topic,



            key:

                this.router.aggregateRoutingKey(

                    event

                ),



            tenant:

                event.tenantId,



            idempotencyKey,



            payload:

                event


        };



        try {


            await this.eventBus.publish(

                message

            );



            await this.repository.markPublished(

                record.id

            );



            this.processedKeys.add(

                idempotencyKey

            );



            return true;


        }

        catch(error) {


            await this.repository.markFailed(

                record.id,

                error

            );



            throw error;


        }


    }





    /**
     * =========================================================================
     * Exactly Once Simulation
     * =========================================================================
     */


    createIdempotencyKey(event) {


        return crypto

            .createHash('sha256')

            .update(

                [

                    event.eventId,

                    event.eventVersion,

                    event.tenantId

                ]

                .join('|')

            )

            .digest('hex');


    }


}





module.exports = TransactionPublishingEngine;