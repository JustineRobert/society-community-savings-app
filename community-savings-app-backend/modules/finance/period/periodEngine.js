'use strict';

const crypto = require('crypto');


class PeriodEngineError extends Error {

    constructor(code, message, metadata = {}) {

        super(message);

        this.name =
            'PeriodEngineError';

        this.code =
            code;

        this.metadata =
            metadata;

        this.timestamp =
            new Date();
    }
}





class PeriodEngine {


    constructor({

        fiscalCalendar,

        periodLockService,

        periodCloseService,

        adjustmentPeriod,

        reopenWorkflow,

        periodValidator,

        auditService,

        eventBus,

        logger,

        metrics


    } = {}) {


        this.fiscalCalendar =
            fiscalCalendar;


        this.periodLockService =
            periodLockService;


        this.periodCloseService =
            periodCloseService;


        this.adjustmentPeriod =
            adjustmentPeriod;


        this.reopenWorkflow =
            reopenWorkflow;


        this.periodValidator =
            periodValidator;


        this.auditService =
            auditService;


        this.eventBus =
            eventBus;


        this.logger =
            logger;


        this.metrics =
            metrics;

    }






    /**
     * ---------------------------------------------
     * CREATE PERIOD
     * ---------------------------------------------
     */
    async createPeriod({

        tenantId,

        startDate,

        endDate,

        fiscalYear


    }) {


        const validation =
            this.periodValidator
                .validateDates({

                    startDate,

                    endDate

                });



        if(!validation.valid){


            throw new PeriodEngineError(

                'INVALID_PERIOD',

                'Invalid accounting period',

                validation

            );

        }



        const period = {


            id:
                crypto.randomUUID(),


            tenantId,


            startDate,


            endDate,


            fiscalYear,


            status:
                'OPEN',


            createdAt:
                new Date()

        };



        await this.auditService
            ?.record({

                action:
                    'PERIOD_CREATED',

                entity:
                    period

            });



        return period;

    }








    /**
     * ---------------------------------------------
     * GET CURRENT PERIOD
     * ---------------------------------------------
     */
    async getCurrentPeriod({

        tenantId

    }) {


        return this.fiscalCalendar
            .getCurrentPeriod({

                tenantId

            });

    }







    /**
     * ---------------------------------------------
     * VALIDATE POSTING PERIOD
     *
     * Called by Ledger Engine
     * before every posting
     * ---------------------------------------------
     */
    async validatePostingPeriod({

        tenantId,

        transactionDate

    }) {


        const period =
            await this.fiscalCalendar
                .findPeriod({

                    tenantId,

                    date:
                        transactionDate

                });



        if(!period){


            throw new PeriodEngineError(

                'NO_ACCOUNTING_PERIOD',

                'Transaction date has no accounting period'

            );

        }



        if(
            period.status !== 'OPEN'
        ){


            throw new PeriodEngineError(

                'PERIOD_LOCKED',

                'Posting prohibited in closed period',

                {
                    periodId:
                        period.id,

                    status:
                        period.status

                }

            );

        }



        return true;

    }








    /**
     * ---------------------------------------------
     * LOCK PERIOD
     * ---------------------------------------------
     */
    async lockPeriod(periodId, context){


        return this.periodLockService
            .lock({

                periodId,

                context

            });

    }








    /**
     * ---------------------------------------------
     * CLOSE PERIOD
     *
     * OPEN
     *  |
     *  ▼
     * LOCKED
     *  |
     *  ▼
     * CLOSED
     *
     * ---------------------------------------------
     */
    async closePeriod({

        periodId,

        context


    }) {


        const period =
            await this.periodCloseService
                .validateClose({

                    periodId

                });



        await this.periodLockService
            .lock({

                periodId,

                context

            });



        const closed =
            await this.periodCloseService
                .close({

                    periodId,

                    context

                });



        await this.auditService
            ?.record({

                action:
                    'PERIOD_CLOSED',

                entity:
                    closed,

                context

            });



        await this.eventBus
            ?.publish({

                type:
                    'PeriodClosed',

                payload:
                    closed,

                context

            });



        return closed;

    }








    /**
     * ---------------------------------------------
     * REOPEN PERIOD
     *
     * Controlled exception workflow
     * ---------------------------------------------
     */
    async reopenPeriod({

        periodId,

        approvalRequest,

        context


    }) {


        const approved =
            await this.reopenWorkflow
                .request({

                    periodId,

                    approvalRequest,

                    context

                });



        if(!approved){


            throw new PeriodEngineError(

                'REOPEN_NOT_APPROVED',

                'Period reopening requires approval'

            );

        }



        return this.periodCloseService
            .reopen({

                periodId,

                context

            });

    }



}




module.exports = {

    PeriodEngine,

    PeriodEngineError

};