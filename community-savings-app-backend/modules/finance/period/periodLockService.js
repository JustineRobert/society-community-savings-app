'use strict';


class PeriodLockService {


    constructor({

        repository

    }={}){


        this.repository =
            repository;

    }





    async lock({

        periodId,

        context

    }) {


        return this.repository
            .update({

                id:
                    periodId

            },{


                status:
                    'LOCKED',


                lockedBy:
                    context?.userId,


                lockedAt:
                    new Date()

            });

    }




    async unlock(periodId){


        return this.repository
            .update({

                id:
                    periodId

            },{


                status:
                    'OPEN'

            });

    }


}



module.exports =
    PeriodLockService;