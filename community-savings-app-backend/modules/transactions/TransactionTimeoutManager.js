'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Timeout Manager
 * ============================================================================
 *
 * Controls transaction execution deadlines and prevents stuck financial
 * operations.
 *
 * Responsibilities
 * ----------------
 * • Transaction timeout tracking
 * • Operation timeout enforcement
 * • Deadline management
 * • Timeout detection
 * • Automatic escalation
 * • Cancellation signaling
 * • Recovery integration
 * • Audit publishing
 * • Metrics
 * • Distributed tracing
 *
 * ============================================================================
 */

const EventEmitter = require('events');
const crypto = require('crypto');


const DEFAULT_TIMEOUTS = Object.freeze({

    transaction: 120000,

    operation: 30000,

    monitorInterval: 5000

});


class TransactionTimeoutManager extends EventEmitter {


    constructor(options = {}) {

        super();


        this.logger =
            options.logger || console;


        this.metrics =
            options.metrics;


        this.tracer =
            options.tracer;


        this.auditPublisher =
            options.auditPublisher;


        this.eventBus =
            options.eventBus;


        this.recoveryManager =
            options.recoveryManager;



        this.timeouts = new Map();


        this.controllers = new Map();


        this.running = false;


        this.timer = null;



        this.config = {

            ...DEFAULT_TIMEOUTS,

            ...options

        };


    }



    /**
     * =========================================================================
     * Register Transaction Timeout
     * =========================================================================
     */


    register(transactionId, options = {}) {


        const timeout = {

            id:
                crypto.randomUUID(),


            transactionId,


            tenantId:
                options.tenantId || null,


            timeout:

                options.timeout ||

                this.config.transaction,


            createdAt:

                new Date(),


            expiresAt:

                new Date(

                    Date.now() +

                    (

                        options.timeout ||

                        this.config.transaction

                    )

                ),



            status:

                'ACTIVE',



            metadata:

                options.metadata || {}

        };



        this.timeouts.set(

            transactionId,

            timeout

        );



        this.createAbortController(

            transactionId

        );



        this.emit(

            'registered',

            timeout

        );



        return timeout;

    }



    /**
     * =========================================================================
     * Register Operation Timeout
     * =========================================================================
     */


    registerOperation(transactionId, operation, timeout) {


        return this.register(

            `${transactionId}:${operation}`,

            {

                timeout:

                    timeout ||

                    this.config.operation

            }

        );

    }



    /**
     * =========================================================================
     * Start Monitor
     * =========================================================================
     */


    start() {


        if (this.running) {

            return;

        }


        this.running = true;



        this.timer = setInterval(

            () =>

                this.checkExpired()

                .catch(error => {


                    this.logger.error?.(

                        '[TimeoutManager] Monitor error',

                        error

                    );


                }),


            this.config.monitorInterval

        );



        this.logger.info?.(

            '[TimeoutManager] Started'

        );


    }



    /**
     * =========================================================================
     * Stop Monitor
     * =========================================================================
     */


    stop() {


        this.running = false;



        if (this.timer) {

            clearInterval(

                this.timer

            );


            this.timer = null;

        }


    }



    /**
     * =========================================================================
     * Check Expired Transactions
     * =========================================================================
     */


    async checkExpired() {


        const now = Date.now();



        for (

            const timeout of this.timeouts.values()

        ) {


            if (

                timeout.status !== 'ACTIVE'

            ) {

                continue;

            }



            if (

                timeout.expiresAt.getTime()

                <=

                now

            ) {


                await this.handleTimeout(

                    timeout

                );

            }

        }


    }



    /**
     * =========================================================================
     * Handle Timeout
     * =========================================================================
     */


    async handleTimeout(timeout) {


        const span =

            this.tracer?.startSpan?.(

                'transaction.timeout'

            );



        try {



            timeout.status = 'EXPIRED';


            timeout.expiredAt = new Date();



            this.metrics?.increment?.(

                'transaction_timeout_total'

            );



            this.logger.warn?.(

                '[TimeoutManager] Transaction timeout',

                {

                    transactionId:

                        timeout.transactionId

                }

            );



            this.abort(

                timeout.transactionId

            );



            await this.auditPublisher?.publish?.({

                type:

                    'TRANSACTION_TIMEOUT',


                transactionId:

                    timeout.transactionId,


                timestamp:

                    new Date(),


                metadata:

                    timeout.metadata


            });



            await this.eventBus?.publish?.({

                type:

                    'transaction.timeout',


                transactionId:

                    timeout.transactionId

            });



            this.emit(

                'timeout',

                timeout

            );



            if (

                this.recoveryManager

            ) {


                await this.recoveryManager.recoverById(

                    timeout.transactionId

                )

                .catch(error => {


                    this.logger.error?.(

                        '[TimeoutManager] Recovery failed',

                        error

                    );


                });


            }



        }

        finally {


            span?.end?.();


        }


    }



    /**
     * =========================================================================
     * Complete Transaction
     * =========================================================================
     */


    complete(transactionId) {


        const timeout =

            this.timeouts.get(

                transactionId

            );



        if (!timeout) {

            return false;

        }



        timeout.status = 'COMPLETED';


        timeout.completedAt = new Date();



        this.cleanup(

            transactionId

        );



        return true;


    }



    /**
     * =========================================================================
     * Cancel Transaction Timeout
     * =========================================================================
     */


    cancel(transactionId) {


        const timeout =

            this.timeouts.get(

                transactionId

            );



        if (!timeout) {

            return false;

        }



        timeout.status = 'CANCELLED';



        this.cleanup(

            transactionId

        );



        return true;

    }



    /**
     * =========================================================================
     * Abort Controller
     * =========================================================================
     */


    createAbortController(transactionId) {


        const controller =

            new AbortController();



        this.controllers.set(

            transactionId,

            controller

        );



        return controller;

    }



    getAbortSignal(transactionId) {


        return this.controllers

            .get(transactionId)

            ?.signal;


    }



    abort(transactionId) {


        const controller =

            this.controllers.get(

                transactionId

            );



        if (controller) {


            controller.abort(

                'Transaction timeout'

            );

        }


    }



    /**
     * =========================================================================
     * Execute With Timeout
     * =========================================================================
     */


    async execute(operation, options = {}) {


        const timeout =

            options.timeout ||

            this.config.operation;



        return Promise.race([


            operation(),



            new Promise(

                (_, reject) => {


                    setTimeout(

                        () => {


                            const error =

                                new Error(

                                    'Operation timeout'

                                );


                            error.code =

                                'OPERATION_TIMEOUT';



                            reject(error);


                        },


                        timeout

                    );


                }

            )


        ]);


    }



    /**
     * =========================================================================
     * Cleanup
     * =========================================================================
     */


    cleanup(transactionId) {


        this.timeouts.delete(

            transactionId

        );


        this.controllers.delete(

            transactionId

        );


    }



    /**
     * =========================================================================
     * Status
     * =========================================================================
     */


    getStatus(transactionId) {


        return this.timeouts.get(

            transactionId

        ) || null;


    }



    /**
     * =========================================================================
     * Statistics
     * =========================================================================
     */


    getStatistics() {


        return {


            activeTimeouts:

                this.timeouts.size,


            controllers:

                this.controllers.size,


            running:

                this.running


        };


    }



    /**
     * =========================================================================
     * Shutdown
     * =========================================================================
     */


    shutdown() {


        this.stop();



        for (

            const id of this.controllers.keys()

        ) {


            this.abort(id);

        }



        this.timeouts.clear();


        this.controllers.clear();


    }


}



module.exports = TransactionTimeoutManager;