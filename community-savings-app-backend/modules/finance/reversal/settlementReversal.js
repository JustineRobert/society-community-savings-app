'use strict';


class SettlementReversal {


    constructor({

        ledgerEngine,

        compensationBuilder,

        reconciliationService

    }={}) {


        this.ledgerEngine =
            ledgerEngine;


        this.compensationBuilder =
            compensationBuilder;


        this.reconciliationService =
            reconciliationService;

    }





    async execute({

        originalLedgerId,

        reason,

        providerReference,

        context

    }) {



        await this.reconciliationService
            ?.validateSettlementReversal({

                providerReference

            });



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

                settlementReversal:true

            },

            context

        );

    }


}



module.exports =
    SettlementReversal;