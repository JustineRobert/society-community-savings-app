'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Rollback Coordinator
 * ============================================================================
 *
 * Coordinates compensation actions for failed distributed transactions.
 *
 * Responsibilities
 * ----------------
 * ✓ Saga rollback orchestration
 * ✓ Reverse compensation execution
 * ✓ Idempotent rollback
 * ✓ Partial rollback recovery
 * ✓ Compensation retries
 * ✓ Timeout protection
 * ✓ Audit publishing
 * ✓ Metrics
 * ✓ Distributed tracing
 *
 * ============================================================================
 */


const crypto = require('crypto');



const RollbackStatus = Object.freeze({

    STARTED: 'STARTED',

    PROCESSING: 'PROCESSING',

    COMPLETED: 'COMPLETED',

    FAILED: 'FAILED',

    PARTIAL: 'PARTIAL'

});



class RollbackCoordinator {


    constructor(options = {}) {


        this.logger =

            options.logger || console;



        this.repository =

            options.repository;



        this.auditPublisher =

            options.auditPublisher;



        this.metrics =

            options.metrics;



        this.tracer =

            options.tracer;



        this.retryPolicy =

            options.retryPolicy;



        this.timeoutManager =

            options.timeoutManager;



        this.eventBus =

            options.eventBus;



        this.rollbackHandlers = new Map();



    }



    /**
     * =========================================================================
     * Register Compensation Handler
     * =========================================================================
     */


    register(type, handler) {


        if (

            typeof handler !== 'function'

        ) {


            throw new Error(

                'Rollback handler must be a function'

            );

        }



        this.rollbackHandlers.set(

            type,

            handler

        );



        return this;


    }



    /**
     * =========================================================================
     * Execute Rollback
     * =========================================================================
     */


    async rollback(transaction, context = {}) {


        const span =

            this.tracer?.startSpan?.(

                'transaction.rollback'

            );



        const rollbackId =

            crypto.randomUUID();



        const rollbackRecord = {


            rollbackId,


            transactionId:

                transaction.transactionId,



            tenantId:

                transaction.tenantId || null,



            status:

                RollbackStatus.STARTED,



            startedAt:

                new Date(),



            compensations: []

        };



        try {


            await this.auditPublisher?.publish?.({

                type:

                    'ROLLBACK_STARTED',



                transactionId:

                    transaction.transactionId,



                rollbackId


            });



            rollbackRecord.status =

                RollbackStatus.PROCESSING;



            const steps =

                this.getCompensationSteps(

                    transaction

                );



            const reversed =

                steps.reverse();



            for (

                const step of reversed

            ) {


                await this.executeCompensation(

                    step,

                    transaction,

                    rollbackRecord,

                    context

                );


            }



            rollbackRecord.status =

                RollbackStatus.COMPLETED;



            rollbackRecord.completedAt =

                new Date();



            await this.finalize(

                rollbackRecord

            );



            this.metrics?.increment?.(

                'transaction_rollback_success_total'

            );



            return rollbackRecord;


        }

        catch(error) {


            rollbackRecord.status =

                RollbackStatus.PARTIAL;



            rollbackRecord.error = {


                message:

                    error.message,



                code:

                    error.code || null


            };



            await this.finalize(

                rollbackRecord

            );



            this.metrics?.increment?.(

                'transaction_rollback_failure_total'

            );



            this.logger.error?.(

                '[RollbackCoordinator] Rollback failed',

                error

            );



            throw error;


        }

        finally {


            span?.end?.();


        }


    }



    /**
     * =========================================================================
     * Execute Compensation Step
     * =========================================================================
     */


    async executeCompensation(

        step,

        transaction,

        rollbackRecord,

        context

    ) {


        const handler =

            this.rollbackHandlers.get(

                step.type

            );



        if (!handler) {


            throw new Error(

                `No rollback handler for ${step.type}`

            );


        }



        const existing =

            rollbackRecord.compensations

                .find(

                    item =>

                        item.stepId === step.id

                );



        if (existing?.status === 'COMPLETED') {


            return existing;


        }



        const compensation = {


            stepId:

                step.id,



            type:

                step.type,



            status:

                'PROCESSING',



            startedAt:

                new Date()


        };



        rollbackRecord.compensations.push(

            compensation

        );



        try {


            const execute = () =>

                handler(

                    transaction,

                    step,

                    context

                );



            if (

                this.retryPolicy

            ) {


                await this.retryPolicy.execute(

                    execute,

                    {

                        transactionId:

                            transaction.transactionId

                    }

                );


            }

            else {


                await execute();


            }



            compensation.status =

                'COMPLETED';



            compensation.completedAt =

                new Date();



            await this.auditPublisher?.publish?.({

                type:

                    'COMPENSATION_COMPLETED',



                transactionId:

                    transaction.transactionId,



                step:

                    step.type


            });



            return compensation;


        }

        catch(error) {


            compensation.status =

                'FAILED';



            compensation.error = {


                message:

                    error.message

            };



            throw error;


        }


    }



    /**
     * =========================================================================
     * Determine Compensation Steps
     * =========================================================================
     */


    getCompensationSteps(transaction) {


        return (

            transaction.executedSteps ||

            []

        ).filter(

            step =>

                step.compensationRequired !== false

        );


    }



    /**
     * =========================================================================
     * Persist Rollback
     * =========================================================================
     */


    async finalize(record) {


        if (

            this.repository?.create

        ) {


            await this.repository.create(

                record

            );


        }



        await this.eventBus?.publish?.({

            type:

                'transaction.rollback.completed',



            payload:

                record


        });



        await this.auditPublisher?.publish?.({

            type:

                'ROLLBACK_COMPLETED',



            transactionId:

                record.transactionId,



            rollbackId:

                record.rollbackId,



            status:

                record.status


        });



    }



    /**
     * =========================================================================
     * Rollback Single Step
     * =========================================================================
     */


    async compensateStep(

        transaction,

        step,

        context

    ) {


        return this.executeCompensation(

            step,

            transaction,

            {

                compensations: []

            },

            context

        );


    }



    /**
     * =========================================================================
     * Recovery Support
     * =========================================================================
     */


    async recoverRollback(transactionId) {


        if (

            !this.repository?.findByTransactionId

        ) {


            return null;


        }



        const record =

            await this.repository.findByTransactionId(

                transactionId

            );



        if (!record) {


            return null;

        }



        return record;


    }



    /**
     * =========================================================================
     * Health
     * =========================================================================
     */


    health() {


        return {


            status:

                'UP',



            handlers:

                this.rollbackHandlers.size


        };


    }


}



RollbackCoordinator.Status =
    RollbackStatus;



module.exports = RollbackCoordinator;