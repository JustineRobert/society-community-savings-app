'use strict';


class AdjustmentPeriod {


    async create({

        tenantId,

        reason,

        approvalId

    }) {


        return {


            tenantId,


            type:
                'ADJUSTMENT',


            reason,


            approvalId,


            status:
                'OPEN',


            createdAt:
                new Date()

        };

    }


}



module.exports =
    AdjustmentPeriod;