'use strict';


class AdjustmentManager {


    constructor({

        ledgerEngine

    }={}) {


        this.ledgerEngine =
            ledgerEngine;

    }





    async execute({

        journal,

        reason,

        context

    }) {



        return this.ledgerEngine.post(

            {

                journal,

                adjustment:true,

                reason

            },

            context

        );

    }


}


module.exports =
    AdjustmentManager;