'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Transaction Event Router
 * ============================================================================
 *
 * Responsibilities:
 *
 * - Resolve event destination
 * - Tenant routing
 * - Aggregate routing
 * - Provider routing
 *
 * ============================================================================
 */


class TransactionEventRouter {


    constructor(options = {}) {


        this.routes =

            options.routes || {};



        this.defaultTopic =

            options.defaultTopic ||

            'transactions.events';


    }





    /**
     * =========================================================================
     * Resolve Route
     * =========================================================================
     */


    resolve(event) {


        const topic =

            this.resolveTopic(event);



        return {


            topic,


            tenantId:

                event.tenantId,



            aggregate:

                event.aggregate,



            eventType:

                event.eventType


        };


    }





    /**
     * =========================================================================
     * Topic Resolution
     * =========================================================================
     */


    resolveTopic(event) {


        const customRoute =

            this.routes[event.eventType];



        if (

            customRoute

        ) {


            return customRoute;


        }



        if (

            event.aggregate?.type

        ) {


            return [

                'aggregate',

                event.aggregate.type.toLowerCase()

            ].join('.');


        }



        return this.defaultTopic;


    }





    /**
     * =========================================================================
     * Tenant Routing Key
     * =========================================================================
     */


    tenantRoutingKey(event) {


        return [

            'tenant',

            event.tenantId

        ]

        .join(':');


    }





    /**
     * =========================================================================
     * Aggregate Ordering Key
     * =========================================================================
     */


    aggregateRoutingKey(event) {


        return [

            event.aggregate?.type,

            event.aggregate?.id

        ]

        .filter(Boolean)

        .join(':');


    }


}





module.exports = TransactionEventRouter;