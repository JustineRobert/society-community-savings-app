'use strict';


class CompensationBuilder {


    constructor({

        journalService

    } = {}) {


        this.journalService =
            journalService;

    }





    async build({

        originalLedger,

        reason,

        context

    }) {



        const entries =
            originalLedger.entries.map(entry => {


                return {


                    accountId:
                        entry.accountId,


                    debit:
                        entry.credit,


                    credit:
                        entry.debit,


                    reference:

                        originalLedger.id,


                    description:

                        `Reversal: ${reason}`

                };


            });



        return this.journalService.build({

            entries,


            metadata:{

                reversal:true,

                originalLedgerId:
                    originalLedger.id,

                reason

            },


            context

        });

    }


}


module.exports =
    CompensationBuilder;