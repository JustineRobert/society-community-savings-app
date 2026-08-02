'use strict';


class LoanDisbursementReversal {


    constructor({

        ledgerEngine,

        compensationBuilder

    }={}) {


        this.ledgerEngine =
            ledgerEngine;


        this.compensationBuilder =
            compensationBuilder;

    }





    async execute({

        originalLedgerId,

        reason,

        context

    }) {



        const ledger =
            await this.ledgerEngine
                .repositories
                .ledger
                .findById(
                    originalLedgerId
                );



        const journal =
            await this.compensationBuilder
                .build({

                    originalLedger:
                        ledger,

                    reason,

                    context

                });



        return this.ledgerEngine.post(

            {

                journal,

                loanReversal:true

            },

            context

        );

    }


}


module.exports =
    LoanDisbursementReversal;