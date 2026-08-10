'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Module
 * ============================================================================
 *
 * Transaction domain composition root.
 *
 * Responsibilities:
 *
 *  - Export transaction components
 *  - Create configured transaction runtime
 *  - Wire dependencies
 *  - Provide health information
 *  - Provide lifecycle management
 *
 * ============================================================================
 */



/**
 * ============================================================================
 * Core Components
 * ============================================================================
 */


const DistributedTransactionManager =

    require('./DistributedTransactionManager');



const TransactionContext =

    require('./TransactionContext');



const TransactionStateMachine =

    require('./TransactionStateMachine');



const TransactionRepository =

    require('./TransactionRepository');



const TransactionLockManager =

    require('./TransactionLockManager');



const TransactionRecoveryManager =

    require('./TransactionRecoveryManager');



const TransactionRetryPolicy =

    require('./TransactionRetryPolicy');



const TransactionTimeoutManager =

    require('./TransactionTimeoutManager');



const TransactionAuditPublisher =

    require('./TransactionAuditPublisher');



const TransactionMetrics =

    require('./TransactionMetrics');



const TransactionTracer =

    require('./TransactionTracer');



const TransactionLogger =

    require('./TransactionLogger');



const TransactionValidator =

    require('./TransactionValidator');



const TransactionIdempotencyManager =

    require('./TransactionIdempotencyManager');



const RollbackCoordinator =

    require('./RollbackCoordinator');



const CompensationManager =

    require('./CompensationManager');



const TransactionEvents =

    require('./TransactionEvents');



const TransactionErrors =

    require('./TransactionErrors');



const TransactionConstants =

    require('./TransactionConstants');





/**
 * ============================================================================
 * Transaction Runtime Factory
 * ============================================================================
 */


function createTransactionModule(options = {}) {


    const logger =

        options.logger ||

        new TransactionLogger({

            serviceName:

                options.serviceName

        });



    const metrics =

        options.metrics ||

        new TransactionMetrics({

            logger

        });



    const tracer =

        options.tracer ||

        new TransactionTracer({

            logger,

            metrics

        });



    const auditPublisher =

        options.auditPublisher ||

        new TransactionAuditPublisher({

            logger,

            metrics,

            tracer

        });



    const repository =

        options.repository ||

        new TransactionRepository({

            logger

        });



    const retryPolicy =

        options.retryPolicy ||

        new TransactionRetryPolicy({

            logger,

            metrics

        });



    const timeoutManager =

        options.timeoutManager ||

        new TransactionTimeoutManager({

            logger,

            metrics

        });



    const lockManager =

        options.lockManager ||

        new TransactionLockManager({

            logger,

            metrics

        });



    const idempotencyManager =

        options.idempotencyManager ||

        new TransactionIdempotencyManager({

            logger,

            metrics

        });



    const validator =

        new TransactionValidator({

            logger,

            metrics,

            auditPublisher,

            idempotencyStore:

                idempotencyManager

        });



    const compensationManager =

        new CompensationManager({

            logger,

            repository,

            retryPolicy,

            timeoutManager,

            auditPublisher,

            metrics,

            tracer,

            eventBus:

                options.eventBus

        });



    const rollbackCoordinator =

        new RollbackCoordinator({

            logger,

            repository,

            retryPolicy,

            timeoutManager,

            auditPublisher,

            metrics,

            tracer,

            eventBus:

                options.eventBus

        });



    const stateMachine =

        new TransactionStateMachine({

            logger,

            metrics,

            auditPublisher

        });



    const transactionManager =

        new DistributedTransactionManager({

            logger,

            metrics,

            tracer

        });



    return {


        transactionManager,


        stateMachine,


        repository,


        lockManager,


        recoveryManager:

            new TransactionRecoveryManager({

                logger,

                repository,

                rollbackCoordinator,

                metrics

            }),


        retryPolicy,


        timeoutManager,


        auditPublisher,


        metrics,


        tracer,


        logger,


        validator,


        idempotencyManager,


        rollbackCoordinator,


        compensationManager,


        events:

            new TransactionEvents({


                serviceName:

                    options.serviceName


            }),



        health() {


            return {


                status:

                    'UP',



                module:

                    'transactions',



                components: {


                    metrics:

                        metrics.health?.(),



                    tracer:

                        tracer.getStatistics?.(),



                    locks:

                        lockManager.health?.(),



                    recovery:

                        'AVAILABLE'


                }


            };


        },



        async shutdown() {


            await tracer.shutdown?.();


            await timeoutManager.shutdown?.();


            await lockManager.shutdown?.();


        }


    };


}





/**
 * ============================================================================
 * Public Module API
 * ============================================================================
 */


module.exports = {


    /**
     * Factory
     */

    createTransactionModule,



    /**
     * Classes
     */


    DistributedTransactionManager,


    TransactionContext,


    TransactionStateMachine,


    TransactionRepository,


    TransactionLockManager,


    TransactionRecoveryManager,


    TransactionRetryPolicy,


    TransactionTimeoutManager,


    TransactionAuditPublisher,


    TransactionMetrics,


    TransactionTracer,


    TransactionLogger,


    TransactionValidator,


    TransactionIdempotencyManager,


    RollbackCoordinator,


    CompensationManager,


    TransactionEvents,



    /**
     * Errors
     */

    ...TransactionErrors,



    /**
     * Constants
     */

    ...TransactionConstants


};