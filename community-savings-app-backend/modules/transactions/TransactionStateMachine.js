'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction State Machine
 * ============================================================================
 *
 * File:
 * backend/modules/transactions/TransactionStateMachine.js
 *
 * Purpose
 * ----------------------------------------------------------------------------
 *
 * Governs the lifecycle of distributed financial transactions.
 *
 * Responsibilities
 * ----------------------------------------------------------------------------
 *
 * ✓ Strict state transition validation
 * ✓ Saga-compatible lifecycle
 * ✓ Recovery support
 * ✓ Rollback support
 * ✓ Timeout handling
 * ✓ Cancellation handling
 * ✓ Transition history
 * ✓ Immutable transition records
 * ✓ Transition idempotency
 * ✓ Version tracking
 * ✓ Tenant awareness
 * ✓ Correlation tracking
 * ✓ Audit integration
 * ✓ Event publishing
 * ✓ Metrics integration
 * ✓ OpenTelemetry hooks
 * ✓ Structured logging
 * ✓ AbortSignal support
 * ✓ Snapshot / restore
 * ✓ Terminal-state protection
 *
 * Important architectural rule
 * ----------------------------------------------------------------------------
 *
 * This class represents the transaction lifecycle in memory.
 *
 * It does NOT replace the persistent transaction repository.
 *
 * A production transaction coordinator should persist the state transition
 * using an atomic compare-and-swap/version operation such as:
 *
 *   updateOne({
 *       transactionId,
 *       version: expectedVersion
 *   }, {
 *       $set: {
 *           state: nextState
 *       },
 *       $inc: {
 *           version: 1
 *       }
 *   })
 *
 * The state machine therefore acts as the lifecycle authority while the
 * repository remains the distributed source of truth.
 *
 * ============================================================================
 */

const crypto = require('crypto');
const EventEmitter = require('events');


/**
 * ============================================================================
 * Transaction States
 * ============================================================================
 */

const TransactionStates = Object.freeze({

    CREATED:
        'CREATED',

    VALIDATING:
        'VALIDATING',

    PREPARING:
        'PREPARING',

    RUNNING:
        'RUNNING',

    WAITING_EXTERNAL:
        'WAITING_EXTERNAL',

    COMMITTING:
        'COMMITTING',

    COMMITTED:
        'COMMITTED',

    ROLLING_BACK:
        'ROLLING_BACK',

    ROLLED_BACK:
        'ROLLED_BACK',

    RECOVERING:
        'RECOVERING',

    RECOVERED:
        'RECOVERED',

    FAILED:
        'FAILED',

    CANCELLED:
        'CANCELLED',

    TIMED_OUT:
        'TIMED_OUT'

});


/**
 * ============================================================================
 * Terminal States
 * ============================================================================
 */

const TerminalStates = new Set([

    TransactionStates.COMMITTED,

    TransactionStates.ROLLED_BACK,

    TransactionStates.RECOVERED,

    TransactionStates.CANCELLED

]);


/**
 * ============================================================================
 * Allowed State Transitions
 * ============================================================================
 */

const AllowedTransitions = Object.freeze({

    CREATED: [

        TransactionStates.VALIDATING,

        TransactionStates.CANCELLED

    ],

    VALIDATING: [

        TransactionStates.PREPARING,

        TransactionStates.FAILED,

        TransactionStates.CANCELLED

    ],

    PREPARING: [

        TransactionStates.RUNNING,

        TransactionStates.FAILED,

        TransactionStates.CANCELLED

    ],

    RUNNING: [

        TransactionStates.WAITING_EXTERNAL,

        TransactionStates.COMMITTING,

        TransactionStates.ROLLING_BACK,

        TransactionStates.FAILED,

        TransactionStates.TIMED_OUT

    ],

    WAITING_EXTERNAL: [

        TransactionStates.RUNNING,

        TransactionStates.COMMITTING,

        TransactionStates.ROLLING_BACK,

        TransactionStates.TIMED_OUT,

        TransactionStates.FAILED

    ],

    COMMITTING: [

        TransactionStates.COMMITTED,

        TransactionStates.ROLLING_BACK,

        TransactionStates.FAILED,

        TransactionStates.TIMED_OUT

    ],

    COMMITTED: [],

    ROLLING_BACK: [

        TransactionStates.ROLLED_BACK,

        TransactionStates.RECOVERING,

        TransactionStates.FAILED

    ],

    ROLLED_BACK: [],

    RECOVERING: [

        TransactionStates.RECOVERED,

        TransactionStates.ROLLING_BACK,

        TransactionStates.FAILED,

        TransactionStates.TIMED_OUT

    ],

    RECOVERED: [],

    FAILED: [

        TransactionStates.RECOVERING,

        TransactionStates.ROLLING_BACK

    ],

    TIMED_OUT: [

        TransactionStates.RECOVERING,

        TransactionStates.ROLLING_BACK,

        TransactionStates.FAILED

    ],

    CANCELLED: []

});


/**
 * ============================================================================
 * State Categories
 * ============================================================================
 */

const StateCategories = Object.freeze({

    ACTIVE: Object.freeze([

        TransactionStates.CREATED,

        TransactionStates.VALIDATING,

        TransactionStates.PREPARING,

        TransactionStates.RUNNING,

        TransactionStates.WAITING_EXTERNAL,

        TransactionStates.COMMITTING,

        TransactionStates.ROLLING_BACK,

        TransactionStates.RECOVERING

    ]),

    TERMINAL: Object.freeze([

        TransactionStates.COMMITTED,

        TransactionStates.ROLLED_BACK,

        TransactionStates.RECOVERED,

        TransactionStates.CANCELLED

    ]),

    FAILURE: Object.freeze([

        TransactionStates.FAILED,

        TransactionStates.TIMED_OUT

    ])

});


/**
 * ============================================================================
 * Transaction State Machine
 * ============================================================================
 */

class TransactionStateMachine extends EventEmitter {

    constructor(options = {}) {

        super();


        this.logger =
            options.logger ||
            console;


        this.metrics =
            options.metrics ||
            null;


        this.auditPublisher =
            options.auditPublisher ||
            null;


        this.eventBus =
            options.eventBus ||
            null;


        this.tracer =
            options.tracer ||
            null;


        this.transactionId =
            options.transactionId ||
            null;


        this.tenantId =
            options.tenantId ||
            null;


        this.correlationId =
            options.correlationId ||
            null;


        this.requestId =
            options.requestId ||
            null;


        this.userId =
            options.userId ||
            null;


        this.source =
            options.source ||
            'transaction-state-machine';


        this.instanceId =
            options.instanceId ||
            crypto.randomUUID();


        this.state =
            options.initialState ||
            TransactionStates.CREATED;


        this.version =
            Number.isInteger(
                options.version
            )
                ? options.version
                : 0;


        this.history = [];


        this.transitionKeys =
            new Set();


        this.createdAt =
            options.createdAt
                ? new Date(options.createdAt)
                : new Date();


        this.updatedAt =
            options.updatedAt
                ? new Date(options.updatedAt)
                : new Date();


        this.clock =
            options.clock ||
            (() => Date.now());


        this.maxHistory =
            Number.isInteger(
                options.maxHistory
            )
                ? Math.max(
                    1,
                    options.maxHistory
                )
                : 1000;


        this.freezeHistory =
            options.freezeHistory !== false;


        this.validateInitialState();


        /**
         * Initialization is recorded as sequence zero.
         */

        this.recordTransition(

            null,

            this.state,

            'State machine initialized',

            {

                initialization:
                    true

            }

        );

    }


    /**
     * =========================================================================
     * Initial State Validation
     * =========================================================================
     */

    validateInitialState() {

        if (
            !Object.values(
                TransactionStates
            ).includes(
                this.state
            )
        ) {

            throw this.createStateError(

                `Invalid initial transaction state: ${this.state}`

            );

        }


        if (
            !Number.isInteger(
                this.version
            ) ||
            this.version < 0
        ) {

            throw new TypeError(

                'Transaction state version must be a non-negative integer.'

            );

        }

    }


    /**
     * =========================================================================
     * Current State
     * =========================================================================
     */

    getState() {

        return this.state;

    }


    /**
     * =========================================================================
     * Current Version
     * =========================================================================
     */

    getVersion() {

        return this.version;

    }


    /**
     * =========================================================================
     * State Checks
     * =========================================================================
     */

    is(state) {

        return this.state === state;

    }


    isTerminal() {

        return TerminalStates.has(
            this.state
        );

    }


    isActive() {

        return StateCategories.ACTIVE.includes(
            this.state
        );

    }


    isFailureState() {

        return StateCategories.FAILURE.includes(
            this.state
        );

    }


    /**
     * =========================================================================
     * Transition Validation
     * =========================================================================
     */

    canTransition(nextState) {

        if (
            !Object.values(
                TransactionStates
            ).includes(
                nextState
            )
        ) {

            return false;

        }


        const allowed =
            AllowedTransitions[
                this.state
            ] || [];


        return allowed.includes(
            nextState
        );

    }


    /**
     * =========================================================================
     * Get Allowed Transitions
     * =========================================================================
     */

    getAllowedTransitions() {

        return [

            ...(AllowedTransitions[
                this.state
            ] || [])

        ];

    }


    /**
     * =========================================================================
     * Transition
     * =========================================================================
     */

    async transition(
        nextState,
        metadata = {}
    ) {

        this.validateAbortSignal(
            metadata.signal
        );


        if (
            !Object.values(
                TransactionStates
            ).includes(
                nextState
            )
        ) {

            throw this.createStateError(

                `Unknown transaction state: ${nextState}`

            );

        }


        /**
         * Terminal states are immutable.
         */

        if (
            this.isTerminal()
        ) {

            throw this.createTerminalStateError(

                `Transaction ${this.transactionId || ''} is already in terminal state ${this.state}.`

            );

        }


        /**
         * Strict transition validation.
         */

        if (
            !this.canTransition(
                nextState
            )
        ) {

            throw this.createStateError(

                `Illegal transaction transition: ${this.state} -> ${nextState}`

            );

        }


        /**
         * Idempotent transition support.
         *
         * If callers provide the same transitionKey twice, the original
         * transition record is returned instead of mutating the state twice.
         */

        const transitionKey =
            metadata.transitionKey ||
            null;


        if (
            transitionKey &&
            this.transitionKeys.has(
                transitionKey
            )
        ) {

            const existing =
                this.history.find(
                    record =>
                        record.transitionKey ===
                        transitionKey
                );


            if (
                existing
            ) {

                return existing;

            }

        }


        const previousState =
            this.state;


        const previousVersion =
            this.version;


        const nextVersion =
            previousVersion + 1;


        const timestamp =
            new Date(
                this.clock()
            );


        const span =
            this.startTransitionSpan(

                previousState,

                nextState,

                metadata

            );


        /**
         * State mutation happens only after all deterministic validation.
         */

        this.state =
            nextState;


        this.version =
            nextVersion;


        this.updatedAt =
            timestamp;


        const transition =
            this.recordTransition(

                previousState,

                nextState,

                metadata.reason,

                {

                    ...metadata,

                    transitionKey,

                    previousVersion,

                    nextVersion

                },

                timestamp

            );


        /**
         * Structured logging.
         */

        this.safeLog(

            'info',

            '[TransactionStateMachine] Transition',

            {

                transactionId:
                    this.transactionId,

                tenantId:
                    this.tenantId,

                correlationId:
                    this.correlationId,

                from:
                    previousState,

                to:
                    nextState,

                version:
                    nextVersion,

                transitionId:
                    transition.id

            }

        );


        /**
         * Metrics.
         */

        this.safeMetric(

            'transaction_state_transitions_total',

            1,

            {

                from:
                    previousState,

                to:
                    nextState

            }

        );


        /**
         * Terminal state metrics.
         */

        if (
            this.isTerminal()
        ) {

            this.safeMetric(

                'transaction_terminal_states_total',

                1,

                {

                    state:
                        nextState

                }

            );

        }


        /**
         * Audit publication.
         *
         * Observability failure must not silently roll back the already
         * established local state transition.
         */

        await this.publishAudit(

            transition

        );


        /**
         * Domain event.
         */

        await this.publishEvent(

            transition

        );


        /**
         * Local listeners.
         */

        this.emit(

            'transition',

            transition

        );


        this.emit(

            nextState.toLowerCase(),

            transition

        );


        span?.setAttribute?.(

            'transaction.state.version',

            nextVersion

        );


        span?.setAttribute?.(

            'transaction.state.transition_id',

            transition.id

        );


        span?.end?.();


        return transition;

    }


    /**
     * =========================================================================
     * Record Transition
     * =========================================================================
     */

    recordTransition(

        from,

        to,

        reason,

        metadata = {},

        timestamp = new Date(
            this.clock()
        )

    ) {

        const sequence =
            this.history.length;


        const record = {

            id:
                crypto.randomUUID(),

            sequence,

            transactionId:
                this.transactionId,

            tenantId:
                this.tenantId,

            correlationId:
                this.correlationId,

            requestId:
                this.requestId,

            instanceId:
                this.instanceId,

            from:
                from || null,

            to,

            reason:
                reason ||
                null,

            transitionKey:
                metadata.transitionKey ||
                null,

            previousVersion:
                Number.isInteger(
                    metadata.previousVersion
                )
                    ? metadata.previousVersion
                    : null,

            nextVersion:
                Number.isInteger(
                    metadata.nextVersion
                )
                    ? metadata.nextVersion
                    : null,

            source:
                metadata.source ||
                this.source,

            actor:
                metadata.actor ||
                null,

            metadata:
                this.sanitizeMetadata(
                    metadata
                ),

            timestamp:
                new Date(
                    timestamp
                ).toISOString()

        };


        const immutableRecord =
            this.freezeHistory
                ? this.deepFreeze(
                    record
                )
                : Object.freeze({
                    ...record
                });


        this.history.push(
            immutableRecord
        );


        if (
            record.transitionKey
        ) {

            this.transitionKeys.add(
                record.transitionKey
            );

        }


        /**
         * Bound in-memory history.
         *
         * Persistent history must live in the repository/event store.
         */

        if (
            this.history.length >
            this.maxHistory
        ) {

            this.history.shift();

        }


        return immutableRecord;

    }


    /**
     * =========================================================================
     * Audit Publishing
     * =========================================================================
     */

    async publishAudit(
        transition
    ) {

        if (
            !this.auditPublisher?.publish
        ) {

            return;

        }


        try {

            await this.auditPublisher.publish({

                type:
                    'TRANSACTION_STATE_CHANGED',

                transactionId:
                    this.transactionId,

                tenantId:
                    this.tenantId,

                correlationId:
                    this.correlationId,

                transitionId:
                    transition.id,

                sequence:
                    transition.sequence,

                previousState:
                    transition.from,

                currentState:
                    transition.to,

                previousVersion:
                    transition.previousVersion,

                nextVersion:
                    transition.nextVersion,

                metadata:
                    transition.metadata,

                timestamp:
                    transition.timestamp

            });

        }

        catch (error) {

            this.safeLog(

                'error',

                '[TransactionStateMachine] Audit publication failed',

                {

                    transactionId:
                        this.transactionId,

                    transitionId:
                        transition.id,

                    error:
                        this.normalizeError(
                            error
                        )

                }

            );


            this.safeMetric(

                'transaction_state_audit_publish_failures_total'

            );

        }

    }


    /**
     * =========================================================================
     * Event Publishing
     * =========================================================================
     */

    async publishEvent(
        transition
    ) {

        if (
            !this.eventBus?.publish
        ) {

            return;

        }


        try {

            await this.eventBus.publish({

                type:
                    'transaction.state.changed',

                id:
                    transition.id,

                transactionId:
                    this.transactionId,

                tenantId:
                    this.tenantId,

                correlationId:
                    this.correlationId,

                previousState:
                    transition.from,

                currentState:
                    transition.to,

                version:
                    this.version,

                timestamp:
                    transition.timestamp,

                metadata:
                    transition.metadata

            });

        }

        catch (error) {

            this.safeLog(

                'error',

                '[TransactionStateMachine] State event publication failed',

                {

                    transactionId:
                        this.transactionId,

                    transitionId:
                        transition.id,

                    error:
                        this.normalizeError(
                            error
                        )

                }

            );


            this.safeMetric(

                'transaction_state_event_publish_failures_total'

            );

        }

    }


    /**
     * =========================================================================
     * State Transition Span
     * =========================================================================
     */

    startTransitionSpan(

        from,

        to,

        metadata

    ) {

        try {

            return this.tracer?.startSpan?.(

                'transaction.state.transition',

                {

                    attributes: {

                        'transaction.id':
                            this.transactionId ||
                            '',

                        'transaction.tenant_id':
                            this.tenantId ||
                            '',

                        'transaction.state.from':
                            from,

                        'transaction.state.to':
                            to,

                        'transaction.state.version':
                            this.version + 1

                    }

                }

            );

        }

        catch (_) {

            return null;

        }

    }


    /**
     * =========================================================================
     * Lifecycle Helpers
     * =========================================================================
     */

    async validate(
        reason,
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.VALIDATING,

            {

                ...metadata,

                reason

            }

        );

    }


    async prepare(
        reason,
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.PREPARING,

            {

                ...metadata,

                reason

            }

        );

    }


    async run(
        reason,
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.RUNNING,

            {

                ...metadata,

                reason

            }

        );

    }


    async waitExternal(
        reason,
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.WAITING_EXTERNAL,

            {

                ...metadata,

                reason

            }

        );

    }


    async commit(
        metadata = {}
    ) {

        const committing =
            await this.transition(

                TransactionStates.COMMITTING,

                {

                    ...metadata,

                    reason:
                        metadata.reason ||
                        'Transaction commit started'

                }

            );


        const committed =
            await this.transition(

                TransactionStates.COMMITTED,

                {

                    ...metadata,

                    reason:
                        metadata.reason ||
                        'Transaction committed'

                }

            );


        return {

            committing,

            committed

        };

    }


    async rollback(
        reason,
        metadata = {}
    ) {

        const rollingBack =
            await this.transition(

                TransactionStates.ROLLING_BACK,

                {

                    ...metadata,

                    reason

                }

            );


        const rolledBack =
            await this.transition(

                TransactionStates.ROLLED_BACK,

                {

                    ...metadata,

                    reason:
                        reason ||
                        'Transaction rollback completed'

                }

            );


        return {

            rollingBack,

            rolledBack

        };

    }


    async fail(
        error,
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.FAILED,

            {

                ...metadata,

                reason:
                    metadata.reason ||
                    error?.message ||
                    'Transaction failed',

                error:
                    this.normalizeError(
                        error
                    )

            }

        );

    }


    async recover(
        reason,
        metadata = {}
    ) {

        const recovering =
            await this.transition(

                TransactionStates.RECOVERING,

                {

                    ...metadata,

                    reason

                }

            );


        const recovered =
            await this.transition(

                TransactionStates.RECOVERED,

                {

                    ...metadata,

                    reason:
                        reason ||
                        'Transaction recovered'

                }

            );


        return {

            recovering,

            recovered

        };

    }


    async timeout(
        reason =
            'Transaction timeout',
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.TIMED_OUT,

            {

                ...metadata,

                reason

            }

        );

    }


    async cancel(
        reason =
            'Transaction cancelled',
        metadata = {}
    ) {

        return this.transition(

            TransactionStates.CANCELLED,

            {

                ...metadata,

                reason

            }

        );

    }


    /**
     * =========================================================================
     * History
     * =========================================================================
     */

    getHistory() {

        return this.history.map(

            record =>
                this.deepClone(
                    record
                )

        );

    }


    getLastTransition() {

        if (
            !this.history.length
        ) {

            return null;

        }


        return this.deepClone(

            this.history[
                this.history.length - 1
            ]

        );

    }


    getTransition(
        transitionId
    ) {

        const record =
            this.history.find(

                item =>
                    item.id ===
                    transitionId

            );


        return record
            ? this.deepClone(
                record
            )
            : null;

    }


    /**
     * =========================================================================
     * Snapshot
     * =========================================================================
     */

    snapshot() {

        return this.deepFreeze({

            transactionId:
                this.transactionId,

            tenantId:
                this.tenantId,

            correlationId:
                this.correlationId,

            requestId:
                this.requestId,

            userId:
                this.userId,

            instanceId:
                this.instanceId,

            state:
                this.state,

            version:
                this.version,

            createdAt:
                new Date(
                    this.createdAt
                ).toISOString(),

            updatedAt:
                new Date(
                    this.updatedAt
                ).toISOString(),

            history:
                this.getHistory()

        });

    }


    /**
     * =========================================================================
     * Restore
     * =========================================================================
     */

    restore(snapshot) {

        if (
            !snapshot ||
            typeof snapshot !==
            'object'
        ) {

            throw new TypeError(
                'A valid transaction state snapshot is required.'
            );

        }


        if (
            !Object.values(
                TransactionStates
            ).includes(
                snapshot.state
            )
        ) {

            throw this.createStateError(

                `Invalid snapshot state: ${snapshot.state}`

            );

        }


        if (
            !Number.isInteger(
                snapshot.version
            ) ||
            snapshot.version < 0
        ) {

            throw new TypeError(

                'Snapshot version must be a non-negative integer.'

            );

        }


        this.state =
            snapshot.state;


        this.version =
            snapshot.version;


        this.createdAt =
            new Date(
                snapshot.createdAt
            );


        this.updatedAt =
            new Date(
                snapshot.updatedAt
            );


        this.history =
            Array.isArray(
                snapshot.history
            )

                ? snapshot.history.map(

                    record =>
                        this.deepFreeze(
                            this.deepClone(
                                record
                            )
                        )

                )

                : [];


        this.transitionKeys =
            new Set(

                this.history

                    .map(
                        record =>
                            record.transitionKey
                    )

                    .filter(Boolean)

            );


        return this.snapshot();

    }


    /**
     * =========================================================================
     * Serialization
     * =========================================================================
     */

    toJSON() {

        return this.snapshot();

    }


    /**
     * =========================================================================
     * Metadata Sanitization
     * =========================================================================
     *
     * Prevents secrets, tokens and credentials from being persisted into
     * transition history or emitted to the audit/event pipeline.
     */

    sanitizeMetadata(
        value
    ) {

        const sensitiveFields =
            new Set([

                'password',

                'token',

                'accessToken',

                'refreshToken',

                'secret',

                'apiKey',

                'authorization',

                'pin',

                'otp',

                'cardNumber',

                'cvv',

                'securityCode',

                'clientSecret'

            ]);


        const sanitize =
            input => {

                if (
                    input === null ||
                    input === undefined
                ) {

                    return input;

                }


                if (
                    Array.isArray(
                        input
                    )
                ) {

                    return input.map(
                        sanitize
                    );

                }


                if (
                    typeof input !==
                    'object'
                ) {

                    return input;

                }


                const output = {};


                for (
                    const [
                        key,
                        value
                    ]
                    of Object.entries(
                        input
                    )
                ) {

                    if (
                        sensitiveFields.has(
                            key
                        )
                    ) {

                        output[key] =
                            '[REDACTED]';

                    }
                    else {

                        output[key] =
                            sanitize(
                                value
                            );

                    }

                }


                return output;

            };


        return sanitize(
            value
        );

    }


    /**
     * =========================================================================
     * Error Normalization
     * =========================================================================
     */

    normalizeError(
        error
    ) {

        if (!error) {

            return null;

        }


        return {

            name:
                error.name ||
                'Error',

            message:
                error.message ||
                String(error),

            code:
                error.code ||
                null,

            status:
                error.status ??
                error.statusCode ??
                null,

            retryable:
                error.retryable ??
                null

        };

    }


    /**
     * =========================================================================
     * Abort Signal
     * =========================================================================
     */

    validateAbortSignal(
        signal
    ) {

        if (
            signal?.aborted
        ) {

            const error =
                new Error(

                    'Transaction state transition aborted.'

                );


            error.name =
                'AbortError';


            error.code =
                'TRANSACTION_STATE_ABORTED';


            error.retryable =
                false;


            throw error;

        }

    }


    /**
     * =========================================================================
     * Structured Logging Safety
     * =========================================================================
     */

    safeLog(
        level,
        message,
        data
    ) {

        try {

            const loggerMethod =
                this.logger?.[level];


            if (
                typeof loggerMethod ===
                'function'
            ) {

                loggerMethod.call(

                    this.logger,

                    message,

                    data

                );

            }

        }

        catch (_) {

            /**
             * Logging must never break transaction state management.
             */

        }

    }


    /**
     * =========================================================================
     * Metrics Safety
     * =========================================================================
     */

    safeMetric(
        name,
        value = 1,
        labels = undefined
    ) {

        try {

            const increment =
                this.metrics?.increment;


            if (
                typeof increment !==
                'function'
            ) {

                return;

            }


            if (
                labels === undefined
            ) {

                increment.call(

                    this.metrics,

                    name,
                    value

                );

            }
            else {

                increment.call(

                    this.metrics,

                    name,

                    value,

                    labels

                );

            }

        }

        catch (_) {

            /**
             * Metrics are non-critical.
             */

        }

    }


    /**
     * =========================================================================
     * State Errors
     * =========================================================================
     */

    createStateError(
        message
    ) {

        const error =
            new Error(
                message
            );


        error.code =
            'INVALID_TRANSACTION_STATE';


        error.retryable =
            false;


        return error;

    }


    createTerminalStateError(
        message
    ) {

        const error =
            new Error(
                message
            );


        error.code =
            'TRANSACTION_TERMINAL_STATE';


        error.retryable =
            false;


        return error;

    }


    /**
     * =========================================================================
     * Deep Clone
     * =========================================================================
     */

    deepClone(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return value;

        }


        if (
            typeof structuredClone ===
            'function'
        ) {

            try {

                return structuredClone(
                    value
                );

            }

            catch (_) {}

        }


        return JSON.parse(

            JSON.stringify(
                value
            )

        );

    }


    /**
     * =========================================================================
     * Deep Freeze
     * =========================================================================
     */

    deepFreeze(
        value
    ) {

        if (
            !value ||
            typeof value !==
            'object'
        ) {

            return value;

        }


        Object.freeze(
            value
        );


        for (
            const child
            of Object.values(
                value
            )
        ) {

            if (
                child &&
                typeof child ===
                'object' &&
                !Object.isFrozen(
                    child
                )
            ) {

                this.deepFreeze(
                    child
                );

            }

        }


        return value;

    }


    /**
     * =========================================================================
     * Factory
     * =========================================================================
     */

    static create(
        options = {}
    ) {

        return new TransactionStateMachine(
            options
        );

    }


    /**
     * =========================================================================
     * State Helpers
     * =========================================================================
     */

    static isTerminal(
        state
    ) {

        return TerminalStates.has(
            state
        );

    }


    static canTransition(
        from,
        to
    ) {

        return (

            AllowedTransitions[
                from
            ] || []

        ).includes(
            to
        );

    }

}


/**
 * ============================================================================
 * Static Exports
 * ============================================================================
 */

TransactionStateMachine.States =
    TransactionStates;


TransactionStateMachine.AllowedTransitions =
    AllowedTransitions;


TransactionStateMachine.TerminalStates =
    Object.freeze(
        [...TerminalStates]
    );


TransactionStateMachine.StateCategories =
    StateCategories;


module.exports =
    TransactionStateMachine;