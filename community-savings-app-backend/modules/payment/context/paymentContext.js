'use strict';

const crypto =
    require('crypto');



class PaymentContext {


    constructor({

        tenantId,

        userId,

        provider,

        operation,

        correlationId,

        idempotencyKey

    }){


        this.requestId =
            crypto.randomUUID();


        this.tenantId =
            tenantId;


        this.userId =
            userId;


        this.provider =
            provider;


        this.operation =
            operation;


        this.correlationId =
            correlationId;


        this.idempotencyKey =
            idempotencyKey;


        this.createdAt =
            new Date();

    }


}



module.exports =
    PaymentContext;