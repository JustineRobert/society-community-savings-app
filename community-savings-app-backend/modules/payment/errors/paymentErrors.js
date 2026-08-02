'use strict';


class PaymentEngineError extends Error {


    constructor(

        code,

        message,

        metadata={}

    ){

        super(message);


        this.name =
            'PaymentEngineError';


        this.code =
            code;


        this.metadata =
            metadata;


        this.timestamp =
            new Date();

    }

}



module.exports =
    PaymentEngineError;