'use strict';


class PeriodCloseService {


    constructor({

        repository,

        snapshotEngine,

        balanceEngine


    }={}){


        this.repository =
            repository;


        this.snapshotEngine =
            snapshotEngine;


        this.balanceEngine =
            balanceEngine;

    }






    async validateClose({

        periodId

    }) {


        const period =
            await this.repository
                .findById(periodId);



        if(
            period.status !== 'OPEN'
        ){

            throw new Error(
                'Period cannot close'
            );

        }


        return period;

    }







    async close({

        periodId,

        context

    }) {


        const snapshot =
            await this.snapshotEngine
                .create({

                    type:
                        'MONTHLY',

                    periodId

                });



        return this.repository
            .update({

                id:
                    periodId

            },{


                status:
                    'CLOSED',


                snapshotId:
                    snapshot.id,


                closedAt:
                    new Date()

            });

    }






    async reopen({

        periodId,

        context

    }) {


        return this.repository
            .update({

                id:
                    periodId

            },{


                status:
                    'OPEN',


                reopenedAt:
                    new Date()

            });

    }


}



module.exports =
    PeriodCloseService;