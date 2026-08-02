'use strict';


class RefundProcessor {


    constructor({

        ledgerEngine,

        compensationBuilder,

        ledgerRepository

    }={}) {


        this.ledgerEngine =
            ledgerEngine;


        this.compensationBuilder =
            compensationBuilder;


        this.ledgerRepository =
            ledgerRepository;

    }





    async execute({

        originalLedgerId,

        reason,

        context

    }) {


        const original =
            await this.ledgerRepository
                .findById(
                    originalLedgerId
                );



        const journal =
            await this.compensationBuilder
                .build({

                    originalLedger:
                        original,

                    reason,

                    context

                });



        return this.ledgerEngine.post(

            {

                journal,

                reversalOf:
                    originalLedgerId

            },

            context

        );

    }


}


module.exports =
    RefundProcessor;