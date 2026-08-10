'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction State Machine
 * ============================================================================
 *
 * Purpose
 * -------
 * Governs the lifecycle of distributed financial transactions.
 *
 * Features
 * --------
 * ✓ Strict state transition validation
 * ✓ Saga-compatible lifecycle
 * ✓ Rollback support
 * ✓ Recovery support
 * ✓ Timeout state
 * ✓ Cancellation support
 * ✓ Transition history
 * ✓ Event publishing
 * ✓ Audit integration
 * ✓ Metrics integration
 * ✓ OpenTelemetry hooks
 * ✓ Immutable transition log
 *
 * ============================================================================
 */

const EventEmitter = require('events');

const TransactionStates = Object.freeze({

    CREATED: 'CREATED',

    VALIDATING: 'VALIDATING',

    PREPARING: 'PREPARING',

    RUNNING: 'RUNNING',

    WAITING_EXTERNAL: 'WAITING_EXTERNAL',

    COMMITTING: 'COMMITTING',

    COMMITTED: 'COMMITTED',

    ROLLING_BACK: 'ROLLING_BACK',

    ROLLED_BACK: 'ROLLED_BACK',

    RECOVERING: 'RECOVERING',

    RECOVERED: 'RECOVERED',

    FAILED: 'FAILED',

    CANCELLED: 'CANCELLED',

    TIMED_OUT: 'TIMED_OUT'

});

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
        TransactionStates.FAILED
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
        TransactionStates.FAILED
    ],

    RECOVERED: [],

    FAILED: [
        TransactionStates.RECOVERING
    ],

    TIMED_OUT: [
        TransactionStates.RECOVERING,
        TransactionStates.ROLLING_BACK
    ],

    CANCELLED: []

});

class TransactionStateMachine extends EventEmitter {

    constructor(options = {}) {

        super();

        this.logger = options.logger || console;

        this.metrics = options.metrics;

        this.auditPublisher = options.auditPublisher;

        this.eventBus = options.eventBus;

        this.tracer = options.tracer;

        this.transactionId =
            options.transactionId || null;

        this.state =
            options.initialState ||
            TransactionStates.CREATED;

        this.history = [];

        this.createdAt = new Date();

        this.recordTransition(
            null,
            this.state,
            'State machine initialized'
        );
    }

    /**
     * =========================================================================
     * Current State
     * =========================================================================
     */

    getState() {

        return this.state;

    }

    is(state) {

        return this.state === state;

    }

    /**
     * =========================================================================
     * Transition Validation
     * =========================================================================
     */

    canTransition(nextState) {

        const allowed =
            AllowedTransitions[this.state] || [];

        return allowed.includes(nextState);

    }

    /**
     * =========================================================================
     * Transition
     * =========================================================================
     */

    async transition(nextState, metadata = {}) {

        if (!this.canTransition(nextState)) {

            const error = new Error(

                `Illegal transaction transition: ${this.state} -> ${nextState}`

            );

            error.code = 'INVALID_TRANSACTION_STATE';

            throw error;
        }

        const previousState = this.state;

        const span =
            this.tracer?.startSpan?.(
                'transaction.state.transition',
                {
                    attributes: {
                        transactionId: this.transactionId,
                        from: previousState,
                        to: nextState
                    }
                }
            );

        this.state = nextState;

        const transition =
            this.recordTransition(
                previousState,
                nextState,
                metadata.reason,
                metadata
            );

        this.logger.info?.(
            '[TransactionStateMachine] Transition',
            {
                transactionId: this.transactionId,
                from: previousState,
                to: nextState
            }
        );

        this.metrics?.increment?.(
            'transaction_state_transitions_total',
            {
                from: previousState,
                to: nextState
            }
        );

        await this.auditPublisher?.publish?.({

            type: 'TRANSACTION_STATE_CHANGED',

            transactionId: this.transactionId,

            previousState,

            currentState: nextState,

            metadata,

            timestamp: new Date()

        });

        await this.eventBus?.publish?.({

            type: 'transaction.state.changed',

            transactionId: this.transactionId,

            previousState,

            currentState: nextState

        });

        this.emit('transition', transition);

        this.emit(nextState.toLowerCase(), transition);

        span?.end?.();

        return transition;

    }

    /**
     * =========================================================================
     * Record Transition
     * =========================================================================
     */

    recordTransition(from, to, reason, metadata = {}) {

        const record = {

            id: this.history.length + 1,

            transactionId: this.transactionId,

            from,

            to,

            reason: reason || null,

            metadata,

            timestamp: new Date()

        };

        this.history.push(record);

        return Object.freeze({ ...record });

    }

    /**
     * =========================================================================
     * Helpers
     * =========================================================================
     */

    async validate(reason) {

        return this.transition(
            TransactionStates.VALIDATING,
            { reason }
        );

    }

    async prepare(reason) {

        return this.transition(
            TransactionStates.PREPARING,
            { reason }
        );

    }

    async run(reason) {

        return this.transition(
            TransactionStates.RUNNING,
            { reason }
        );

    }

    async waitExternal(reason) {

        return this.transition(
            TransactionStates.WAITING_EXTERNAL,
            { reason }
        );

    }

    async commit() {

        await this.transition(
            TransactionStates.COMMITTING
        );

        return this.transition(
            TransactionStates.COMMITTED
        );

    }

    async rollback(reason) {

        await this.transition(
            TransactionStates.ROLLING_BACK,
            { reason }
        );

        return this.transition(
            TransactionStates.ROLLED_BACK,
            { reason }
        );

    }

    async fail(error) {

        return this.transition(
            TransactionStates.FAILED,
            {
                reason: error?.message,
                error: {
                    name: error?.name,
                    code: error?.code,
                    stack: error?.stack
                }
            }
        );

    }

    async recover(reason) {

        await this.transition(
            TransactionStates.RECOVERING,
            { reason }
        );

        return this.transition(
            TransactionStates.RECOVERED,
            { reason }
        );

    }

    async timeout() {

        return this.transition(
            TransactionStates.TIMED_OUT,
            {
                reason: 'Transaction timeout'
            }
        );

    }

    async cancel(reason) {

        return this.transition(
            TransactionStates.CANCELLED,
            { reason }
        );

    }

    /**
     * =========================================================================
     * History
     * =========================================================================
     */

    getHistory() {

        return [...this.history];

    }

    getLastTransition() {

        return this.history.length
            ? this.history[this.history.length - 1]
            : null;

    }

    /**
     * =========================================================================
     * Serialization
     * =========================================================================
     */

    toJSON() {

        return {

            transactionId: this.transactionId,

            state: this.state,

            createdAt: this.createdAt,

            transitionCount: this.history.length,

            history: [...this.history]

        };

    }

    /**
     * =========================================================================
     * Factory
     * =========================================================================
     */

    static create(options = {}) {

        return new TransactionStateMachine(options);

    }

}

TransactionStateMachine.States = TransactionStates;
TransactionStateMachine.AllowedTransitions = AllowedTransitions;

module.exports = TransactionStateMachine;