'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * MTN MoMo Callback Module
 * =============================================================================
 *
 * Enterprise Composition Root
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Wire callback subsystem dependencies
 * • Validate required services
 * • Build callback processing pipeline
 * • Expose public module API
 *
 * Pipeline
 * -----------------------------------------------------------------------------
 *
 * HTTP Request
 *      │
 *      ▼
 * CallbackController
 *      │
 *      ▼
 * CallbackProcessor
 *      │
 *      ├────────► SignatureVerifier
 *      ├────────► CallbackValidator
 *      ├────────► PaymentStateUpdater
 *      ├────────► LedgerPoster
 *      ├────────► ReconciliationMatcher
 *      ├────────► CallbackDeadLetterQueue
 *      └────────► Audit / Metrics / EventBus
 *
 * =============================================================================
 */

const CallbackController = require('./callbackController');
const CallbackProcessor = require('./callbackProcessor');
const CallbackValidator = require('./callbackValidator');
const SignatureVerifier = require('./signatureVerifier');
const PaymentStateUpdater = require('./paymentStateUpdater');
const LedgerPoster = require('./ledgerPoster');
const ReconciliationMatcher = require('./reconciliationMatcher');
const CallbackDeadLetterQueue = require('./callbackDeadLetterQueue');

/**
 * ============================================================================
 * Dependency Validation
 * ============================================================================
 */

function validateDependencies(dependencies = {}) {

    const required = [

        'repository',
        'stateMachine',
        'ledgerEngine',
        'reconciliationRepository',
        'deadLetterRepository',
        'callbackSecret'

    ];

    const missing = required.filter(
        dependency => dependencies[dependency] === undefined ||
            dependencies[dependency] === null
    );

    if (missing.length) {

        throw new Error(

            `MTN Callback Module missing required dependencies: ${missing.join(', ')}`

        );

    }


    const MTNCallbackRegistry =
        require('./mtnCallbackRegistry');

    const MTNCallbackNormalizer =
        require('./mtnCallbackNormalizer');

    const MTNCallbackValidator =
        require('./mtnCallbackValidator');

    const MTNCallbackProcessor =
        require('./mtnCallbackProcessor');

    const MTNCallbackIdempotency =
        require('./mtnCallbackIdempotency');

    const MTNCallbackDeadLetter =
        require('./mtnCallbackDeadLetter');

    const errors =
        require('./mtnCallbackErrors');

    module.exports = {
        MTNCallbackRegistry,
        MTNCallbackNormalizer,
        MTNCallbackValidator,
        MTNCallbackProcessor,
        MTNCallbackIdempotency,
        MTNCallbackDeadLetter,
        ...errors,
    };

}

/**
 * ============================================================================
 * Factory
 * ============================================================================
 */

function createCallbackModule(dependencies = {}) {

    validateDependencies(dependencies);

    const logger =
        dependencies.logger || console;

    /**
     * ------------------------------------------------------------------------
     * Shared Services
     * ------------------------------------------------------------------------
     */

    const signatureVerifier =
        new SignatureVerifier({

            secret:
                dependencies.callbackSecret,

            logger

        });

    const validator =
        new CallbackValidator({

            logger

        });

    const stateUpdater =
        new PaymentStateUpdater({

            repository:
                dependencies.repository,

            stateMachine:
                dependencies.stateMachine,

            auditService:
                dependencies.auditService,

            metrics:
                dependencies.metrics,

            eventBus:
                dependencies.eventBus,

            logger

        });

    const ledgerPoster =
        new LedgerPoster({

            ledgerEngine:
                dependencies.ledgerEngine,

            auditService:
                dependencies.auditService,

            metrics:
                dependencies.metrics,

            eventBus:
                dependencies.eventBus,

            logger

        });

    const reconciliationMatcher =
        new ReconciliationMatcher({

            repository:
                dependencies.reconciliationRepository,

            auditService:
                dependencies.auditService,

            metrics:
                dependencies.metrics,

            eventBus:
                dependencies.eventBus,

            logger

        });

    const deadLetterQueue =
        new CallbackDeadLetterQueue({

            repository:
                dependencies.deadLetterRepository,

            auditService:
                dependencies.auditService,

            metrics:
                dependencies.metrics,

            eventBus:
                dependencies.eventBus,

            logger

        });

    /**
     * ------------------------------------------------------------------------
     * Processing Engine
     * ------------------------------------------------------------------------
     */

    const callbackProcessor =
        new CallbackProcessor({

            signatureVerifier,

            validator,

            stateUpdater,

            ledgerPoster,

            reconciliationMatcher,

            deadLetterQueue,

            auditService:
                dependencies.auditService,

            metrics:
                dependencies.metrics,

            eventBus:
                dependencies.eventBus,

            logger

        });

    /**
     * ------------------------------------------------------------------------
     * HTTP Controller
     * ------------------------------------------------------------------------
     */

    const controller =
        new CallbackController({

            callbackProcessor,

            logger

        });

    logger.info?.({

        event: 'payment.mtn.callbacks.initialized',

        provider: 'MTN'

    });

    return {

        /**
         * HTTP Entry Point
         */

        controller,

        /**
         * Processing Pipeline
         */

        callbackProcessor,

        signatureVerifier,

        validator,

        stateUpdater,

        ledgerPoster,

        reconciliationMatcher,

        deadLetterQueue

    };

}

/**
 * ============================================================================
 * Public API
 * ============================================================================
 */

module.exports = {

    createCallbackModule,

    CallbackController,

    CallbackProcessor,

    CallbackValidator,

    SignatureVerifier,

    PaymentStateUpdater,

    LedgerPoster,

    ReconciliationMatcher,

    CallbackDeadLetterQueue

};