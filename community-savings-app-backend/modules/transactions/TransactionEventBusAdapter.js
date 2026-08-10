'use strict';

/**
 * ============================================================================
 * Event Bus Adapter Contract
 * ============================================================================
 *
 * Supports:
 *
 * - Kafka
 * - RabbitMQ
 * - Redis Streams
 * - AWS SNS/SQS
 *
 * ============================================================================
 */


class TransactionEventBusAdapter {


    constructor(options = {}) {


        this.client =

            options.client;



        this.logger =

            options.logger || console;


    }





    async publish(message) {


        throw new Error(

            'publish() must be implemented'

        );


    }





    async publishBatch(messages) {


        const results = [];



        for (

            const message of messages

        ) {


            results.push(

                await this.publish(message)

            );


        }



        return results;


    }





    async health() {


        return {


            status:

                'UNKNOWN'


        };


    }


}





module.exports = TransactionEventBusAdapter;