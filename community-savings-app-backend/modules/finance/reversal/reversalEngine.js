'use strict';

const crypto = require('crypto');


class ReversalEngineError extends Error {

    constructor(code, message, metadata = {}) {

        super(message);

        this.name =
            'ReversalEngineError';

        this.code =
            code;

        this.metadata =
            metadata;

        this.timestamp =
            new Date();
    }
}



class ReversalEngine {


    constructor({

        ledgerEngine,

        compensationBuilder,

        refundProcessor,

        settlementReversal,

        loanDisbursementReversal,

        adjustmentManager,

        auditService,

        eventBus,

        logger,

        metrics

    } = {}) {


        this.ledgerEngine =
            ledgerEngine;


        this.compensationBuilder =
            compensationBuilder;


        this.refundProcessor =
            refundProcessor;


        this.settlementReversal =
            settlementReversal;


        this.loanDisbursementReversal =
            loanDisbursementReversal;


        this.adjustmentManager =
            adjustmentManager;


        this.auditService =
            auditService;


        this.eventBus =
            eventBus;


        this.logger =
            logger;


        this.metrics =
            metrics;

    }





    async reverse({

        type,

        originalLedgerId,

        reason,

        tenantId,

        userId,

        metadata = {}

    }) {


        const reversalId =
            crypto.randomUUID();



        const context = {

            reversalId,

            tenantId,

            userId,

            type,

            startedAt:
                new Date()

        };



        try {


            this.logger?.info?.(
                'Reversal started',
                context
            );



            const strategy =
                this.resolveStrategy(type);



            const reversal =
                await strategy.execute({

                    originalLedgerId,

                    reason,

                    context,

                    metadata

                });



            await this.auditService?.record({

                action:
                    'REVERSAL_CREATED',

                entity:
                    reversal,

                context

            });



            await this.eventBus?.publish({

                type:
                    'LedgerReversed',

                payload:
                    reversal,

                context

            });



            this.metrics?.increment?.(
                'finance.reversal.success'
            );



            return reversal;



        } catch(error) {


            this.metrics?.increment?.(
                'finance.reversal.failed'
            );


            throw new ReversalEngineError(

                'REVERSAL_FAILED',

                error.message,

                {
                    reversalId,
                    originalLedgerId
                }

            );

        }

    }





    resolveStrategy(type) {


        const strategies = {


            REFUND:
                this.refundProcessor,


            SETTLEMENT:
                this.settlementReversal,


            LOAN_DISBURSEMENT:
                this.loanDisbursementReversal,


            ADJUSTMENT:
                this.adjustmentManager


        };



        const strategy =
            strategies[type];



        if(!strategy) {


            throw new ReversalEngineError(

                'UNSUPPORTED_REVERSAL_TYPE',

                `Unsupported reversal type ${type}`

            );

        }



        return strategy;

    }


}



module.exports = {

    ReversalEngine,

    ReversalEngineError

};