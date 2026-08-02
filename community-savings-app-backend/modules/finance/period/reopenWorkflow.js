'use strict';


class ReopenWorkflow {


    constructor({

        approvalService

    }={}){


        this.approvalService =
            approvalService;

    }





    async request({

        periodId,

        approvalRequest,

        context

    }) {


        return this.approvalService
            .approve({

                type:
                    'PERIOD_REOPEN',

                periodId,

                approvalRequest,

                context

            });

    }


}



module.exports =
    ReopenWorkflow;