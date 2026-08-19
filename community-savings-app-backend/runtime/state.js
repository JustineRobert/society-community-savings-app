"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * ============================================================================
 *
 * File:
 *   backend/runtime/state.js
 *
 * Purpose:
 *   Central process-local runtime lifecycle state.
 *
 * Architectural Role:
 *   This module contains STATE and STATE TRANSITIONS only.
 *
 * IMPORTANT:
 *   This module MUST NOT:
 *
 *   - connect to MongoDB
 *   - connect to Redis
 *   - initialize queues
 *   - initialize WebSocket
 *   - configure middleware
 *   - register routes
 *   - create HTTP servers
 *   - initialize loggers
 *   - initialize observability
 *
 *   Bootstrap components mutate this state through the exported lifecycle
 *   functions.
 *
 * ============================================================================
 *
 * Canonical Bootstrap Pipeline
 * ============================================================================
 *
 *   environment
 *        ↓
 *   configuration
 *        ↓
 *   logger
 *        ↓
 *   observability
 *        ↓
 *   resilience
 *        ↓
 *   database
 *        ↓
 *   middleware
 *        ↓
 *   routes
 *        ↓
 *   server
 *        ↓
 *       READY
 *        ↓
 *   SHUTTING_DOWN
 *        ↓
 *      STOPPED
 *
 * ============================================================================
 *
 * Design Principles
 * ============================================================================
 *
 *   ✓ Process-local state only.
 *   ✓ Explicit lifecycle transitions.
 *   ✓ Bootstrap order is deterministic.
 *   ✓ Service state is independent from bootstrap phase.
 *   ✓ Health is distinct from "started".
 *   ✓ Readiness is distinct from health.
 *   ✓ Request counters cannot become negative.
 *   ✓ WebSocket counters cannot become negative.
 *   ✓ Failure information is sanitized.
 *   ✓ Consumers receive snapshots, not mutable internal references.
 *   ✓ Reset support is available for tests.
 *
 * ============================================================================
 */

// =============================================================================
// Bootstrap Phases
// =============================================================================

const BOOTSTRAP_PHASES =
    Object.freeze({

        ENVIRONMENT:
            "environment",

        CONFIGURATION:
            "configuration",

        LOGGER:
            "logger",

        OBSERVABILITY:
            "observability",

        RESILIENCE:
            "resilience",

        DATABASE:
            "database",

        MIDDLEWARE:
            "middleware",

        ROUTES:
            "routes",

        SERVER:
            "server",

        READY:
            "ready",

        SHUTTING_DOWN:
            "shutting_down",

        STOPPED:
            "stopped"

    });

// =============================================================================
// Bootstrap Phase Order
// =============================================================================
//
// This is the canonical startup sequence.
//
// =============================================================================

const BOOTSTRAP_PHASE_ORDER =
    Object.freeze([

        BOOTSTRAP_PHASES.ENVIRONMENT,

        BOOTSTRAP_PHASES.CONFIGURATION,

        BOOTSTRAP_PHASES.LOGGER,

        BOOTSTRAP_PHASES.OBSERVABILITY,

        BOOTSTRAP_PHASES.RESILIENCE,

        BOOTSTRAP_PHASES.DATABASE,

        BOOTSTRAP_PHASES.MIDDLEWARE,

        BOOTSTRAP_PHASES.ROUTES,

        BOOTSTRAP_PHASES.SERVER

    ]);

// =============================================================================
// Service Names
// =============================================================================

const SERVICES =
    Object.freeze({

        LOGGER:
            "logger",

        OBSERVABILITY:
            "observability",

        RESILIENCE:
            "resilience",

        DATABASE:
            "database",

        REDIS:
            "redis",

        QUEUES:
            "queues",

        WEBSOCKET:
            "websocket",

        MIDDLEWARE:
            "middleware",

        ROUTES:
            "routes",

        SERVER:
            "server",

        METRICS:
            "metrics",

        DOCUMENTATION:
            "documentation"

    });

// =============================================================================
// Service States
// =============================================================================

const SERVICE_STATES =
    Object.freeze({

        STOPPED:
            "stopped",

        STARTING:
            "starting",

        READY:
            "ready",

        DEGRADED:
            "degraded",

        STOPPING:
            "stopping",

        FAILED:
            "failed"

    });

// =============================================================================
// Bootstrap Transition Map
// =============================================================================
//
// Each startup phase can transition only to the next canonical phase.
//
// READY is entered only after SERVER is complete.
//
// Shutdown may begin only from READY.
//
// =============================================================================

const BOOTSTRAP_TRANSITIONS =
    Object.freeze({

        [BOOTSTRAP_PHASES.ENVIRONMENT]: [

            BOOTSTRAP_PHASES.CONFIGURATION

        ],

        [BOOTSTRAP_PHASES.CONFIGURATION]: [

            BOOTSTRAP_PHASES.LOGGER

        ],

        [BOOTSTRAP_PHASES.LOGGER]: [

            BOOTSTRAP_PHASES.OBSERVABILITY

        ],

        [BOOTSTRAP_PHASES.OBSERVABILITY]: [

            BOOTSTRAP_PHASES.RESILIENCE

        ],

        [BOOTSTRAP_PHASES.RESILIENCE]: [

            BOOTSTRAP_PHASES.DATABASE

        ],

        [BOOTSTRAP_PHASES.DATABASE]: [

            BOOTSTRAP_PHASES.MIDDLEWARE

        ],

        [BOOTSTRAP_PHASES.MIDDLEWARE]: [

            BOOTSTRAP_PHASES.ROUTES

        ],

        [BOOTSTRAP_PHASES.ROUTES]: [

            BOOTSTRAP_PHASES.SERVER

        ],

        [BOOTSTRAP_PHASES.SERVER]: [

            BOOTSTRAP_PHASES.READY

        ],

        [BOOTSTRAP_PHASES.READY]: [

            BOOTSTRAP_PHASES.SHUTTING_DOWN

        ],

        [BOOTSTRAP_PHASES.SHUTTING_DOWN]: [

            BOOTSTRAP_PHASES.STOPPED

        ],

        [BOOTSTRAP_PHASES.STOPPED]: []

    });

// =============================================================================
// Initial Service State
// =============================================================================

function createInitialServices() {

    return {

        [SERVICES.LOGGER]:
            false,

        [SERVICES.OBSERVABILITY]:
            false,

        [SERVICES.RESILIENCE]:
            false,

        [SERVICES.DATABASE]:
            false,

        [SERVICES.REDIS]:
            false,

        [SERVICES.QUEUES]:
            false,

        [SERVICES.WEBSOCKET]:
            false,

        [SERVICES.MIDDLEWARE]:
            false,

        [SERVICES.ROUTES]:
            false,

        [SERVICES.SERVER]:
            false,

        [SERVICES.METRICS]:
            false,

        [SERVICES.DOCUMENTATION]:
            false

    };

}

// =============================================================================
// Initial Service Lifecycle State
// =============================================================================

function createInitialServiceStates() {

    return {

        [SERVICES.LOGGER]:
            SERVICE_STATES.STOPPED,

        [SERVICES.OBSERVABILITY]:
            SERVICE_STATES.STOPPED,

        [SERVICES.RESILIENCE]:
            SERVICE_STATES.STOPPED,

        [SERVICES.DATABASE]:
            SERVICE_STATES.STOPPED,

        [SERVICES.REDIS]:
            SERVICE_STATES.STOPPED,

        [SERVICES.QUEUES]:
            SERVICE_STATES.STOPPED,

        [SERVICES.WEBSOCKET]:
            SERVICE_STATES.STOPPED,

        [SERVICES.MIDDLEWARE]:
            SERVICE_STATES.STOPPED,

        [SERVICES.ROUTES]:
            SERVICE_STATES.STOPPED,

        [SERVICES.SERVER]:
            SERVICE_STATES.STOPPED,

        [SERVICES.METRICS]:
            SERVICE_STATES.STOPPED,

        [SERVICES.DOCUMENTATION]:
            SERVICE_STATES.STOPPED

    };

}

// =============================================================================
// Internal Application State
// =============================================================================
//
// This object MUST NOT be exported for mutation by consumers.
//
// It is exported for backward compatibility only.
// Consumers should use getApplicationState().
//
// =============================================================================

const applicationState = {

    // -------------------------------------------------------------------------
    // Process lifecycle
    // -------------------------------------------------------------------------

    initialized:
        false,

    starting:
        false,

    started:
        false,

    healthy:
        false,

    ready:
        false,

    shuttingDown:
        false,

    stopped:
        false,

    terminated:
        false,

    failed:
        false,

    // -------------------------------------------------------------------------
    // Bootstrap lifecycle
    // -------------------------------------------------------------------------

    bootstrapPhase:
        null,

    completedPhases: [],

    // -------------------------------------------------------------------------
    // Timestamps
    // -------------------------------------------------------------------------

    startedAt:
        null,

    readyAt:
        null,

    shutdownStartedAt:
        null,

    stoppedAt:
        null,

    lastHealthCheck:
        null,

    // -------------------------------------------------------------------------
    // Failure
    // -------------------------------------------------------------------------

    failure:
        null,

    // -------------------------------------------------------------------------
    // Runtime metrics
    // -------------------------------------------------------------------------

    requestCount:
        0,

    activeRequests:
        0,

    websocketConnections:
        0,

    // -------------------------------------------------------------------------
    // Services
    // -------------------------------------------------------------------------

    services:
        createInitialServices(),

    serviceStates:
        createInitialServiceStates()

};

// =============================================================================
// Utility
// =============================================================================

function now() {

    return new Date();

}

// =============================================================================
// Phase Validation
// =============================================================================

function assertValidPhase(
    phase
) {

    if (
        !Object.values(
            BOOTSTRAP_PHASES
        ).includes(
            phase
        )
    ) {

        throw new Error(
            `Unknown bootstrap phase: ${phase}`
        );

    }

}

function assertValidService(
    service
) {

    if (
        !Object.values(
            SERVICES
        ).includes(
            service
        )
    ) {

        throw new Error(
            `Unknown service: ${service}`
        );

    }

}

function assertValidServiceState(
    state
) {

    if (
        !Object.values(
            SERVICE_STATES
        ).includes(
            state
        )
    ) {

        throw new Error(
            `Unknown service state: ${state}`
        );

    }

}

// =============================================================================
// Bootstrap Phase Transition
// =============================================================================

function updateBootstrapPhase(
    phase,
    events,
    logger
) {

    assertValidPhase(
        phase
    );

    const currentPhase =
        applicationState.bootstrapPhase;

    /*
     * Initial transition.
     *
     * The first valid phase must be ENVIRONMENT.
     */

    if (
        currentPhase === null
    ) {

        if (
            phase !==
            BOOTSTRAP_PHASES.ENVIRONMENT
        ) {

            throw new Error(
                "Bootstrap must begin with the environment phase."
            );

        }

    } else if (
        currentPhase !==
        phase
    ) {

        const allowedTransitions =
            BOOTSTRAP_TRANSITIONS[
                currentPhase
            ] || [];

        if (
            !allowedTransitions.includes(
                phase
            )
        ) {

            throw new Error(

                `Invalid bootstrap transition: ` +
                `${currentPhase} -> ${phase}`

            );

        }

    }

    applicationState.bootstrapPhase =
        phase;

    const timestamp =
        now();

    events?.emit?.(
        "bootstrap.phase.changed",
        {

            previousPhase:
                currentPhase,

            phase,

            timestamp:
                timestamp.toISOString()

        }
    );

    logger?.info?.({

        section:
            "bootstrap",

        previousPhase:
            currentPhase,

        phase

    });

}

// =============================================================================
// Phase Started
// =============================================================================

function markPhaseStarted(
    phase,
    events,
    logger
) {

    assertValidPhase(
        phase
    );

    /*
     * READY, SHUTTING_DOWN and STOPPED are lifecycle states rather than
     * bootstrap work phases and cannot be started through this function.
     */

    if (
        phase ===
            BOOTSTRAP_PHASES.READY ||
        phase ===
            BOOTSTRAP_PHASES.SHUTTING_DOWN ||
        phase ===
            BOOTSTRAP_PHASES.STOPPED
    ) {

        throw new Error(
            `Lifecycle state cannot be started as a bootstrap phase: ${phase}`
        );

    }

    updateBootstrapPhase(
        phase,
        events,
        logger
    );

    applicationState.starting =
        true;

}

// =============================================================================
// Phase Completed
// =============================================================================

function markPhaseCompleted(
    phase,
    events,
    logger
) {

    assertValidPhase(
        phase
    );

    /*
     * Only actual bootstrap phases may be completed.
     */

    if (
        !BOOTSTRAP_PHASE_ORDER.includes(
            phase
        )
    ) {

        throw new Error(
            `Invalid bootstrap completion phase: ${phase}`
        );

    }

    /*
     * A phase cannot be completed without becoming the current phase.
     */

    if (
        applicationState.bootstrapPhase !==
        phase
    ) {

        updateBootstrapPhase(
            phase,
            events,
            logger
        );

    }

    if (
        !applicationState.completedPhases.includes(
            phase
        )
    ) {

        applicationState.completedPhases.push(
            phase
        );

    }

    const service =
        phaseToService(
            phase
        );

    if (
        service
    ) {

        setServiceState(

            service,

            SERVICE_STATES.READY,

            events,

            logger

        );

    }

}

// =============================================================================
// Phase → Service Mapping
// =============================================================================

function phaseToService(
    phase
) {

    switch (
        phase
    ) {

        case BOOTSTRAP_PHASES.LOGGER:

            return SERVICES.LOGGER;

        case BOOTSTRAP_PHASES.OBSERVABILITY:

            return SERVICES.OBSERVABILITY;

        case BOOTSTRAP_PHASES.RESILIENCE:

            return SERVICES.RESILIENCE;

        case BOOTSTRAP_PHASES.DATABASE:

            return SERVICES.DATABASE;

        case BOOTSTRAP_PHASES.MIDDLEWARE:

            return SERVICES.MIDDLEWARE;

        case BOOTSTRAP_PHASES.ROUTES:

            return SERVICES.ROUTES;

        case BOOTSTRAP_PHASES.SERVER:

            return SERVICES.SERVER;

        default:

            return null;

    }

}

// =============================================================================
// Application Starting
// =============================================================================

function markStarting(
    events,
    logger
) {

    if (
        applicationState.terminated ||
        applicationState.stopped
    ) {

        throw new Error(
            "A stopped application cannot be started without resetting runtime state."
        );

    }

    applicationState.initialized =
        true;

    applicationState.starting =
        true;

    applicationState.started =
        false;

    applicationState.ready =
        false;

    applicationState.healthy =
        false;

    applicationState.shuttingDown =
        false;

    applicationState.stopped =
        false;

    applicationState.terminated =
        false;

    applicationState.failed =
        false;

    applicationState.failure =
        null;

    const timestamp =
        now();

    applicationState.startedAt =
        timestamp;

    events?.emit?.(
        "application.starting",
        {
            timestamp
        }
    );

    logger?.info?.({

        section:
            "runtime",

        state:
            "starting"

    });

}

// =============================================================================
// Application Started
// =============================================================================
//
// "Started" means the HTTP server/bootstrap process has completed the startup
// pipeline. Readiness is still explicitly controlled by markApplicationReady.
//
// =============================================================================

function markApplicationStarted(
    events,
    logger
) {

    if (
        applicationState.started
    ) {

        return;

    }

    if (
        applicationState.failed
    ) {

        throw new Error(
            "A failed application cannot be marked started."
        );

    }

    applicationState.initialized =
        true;

    applicationState.starting =
        false;

    applicationState.started =
        true;

    applicationState.ready =
        false;

    applicationState.healthy =
        true;

    events?.emit?.(
        "application.started",
        {

            timestamp:
                now()

        }
    );

    logger?.info?.({

        section:
            "runtime",

        state:
            "started"

    });

}

// =============================================================================
// Application Ready
// =============================================================================

function markApplicationReady(
    events,
    logger
) {

    if (
        applicationState.terminated ||
        applicationState.shuttingDown ||
        applicationState.failed
    ) {

        throw new Error(
            "Cannot mark a terminated, failed, or shutting-down application as ready."
        );

    }

    if (
        applicationState.bootstrapPhase !==
        BOOTSTRAP_PHASES.SERVER
    ) {

        throw new Error(
            "Application cannot become ready before the server bootstrap phase is complete."
        );

    }

    const timestamp =
        now();

    /*
     * Ensure SERVER is part of the completed startup phases.
     */

    if (
        !applicationState.completedPhases.includes(
            BOOTSTRAP_PHASES.SERVER
        )
    ) {

        throw new Error(
            "Application cannot become ready before the server phase is completed."
        );

    }

    applicationState.initialized =
        true;

    applicationState.starting =
        false;

    applicationState.started =
        true;

    applicationState.ready =
        true;

    applicationState.healthy =
        true;

    applicationState.readyAt =
        timestamp;

    applicationState.lastHealthCheck =
        timestamp;

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.READY,
        events,
        logger
    );

    events?.emit?.(
        "application.ready",
        {

            timestamp:
                timestamp.toISOString()

        }
    );

    logger?.info?.({

        section:
            "runtime",

        state:
            "ready"

    });

}

// =============================================================================
// Health Check
// =============================================================================

function markHealthCheck(
    healthy,
    events,
    logger
) {

    const nextHealthState =
        Boolean(
            healthy
        );

    const previousHealthState =
        applicationState.healthy;

    applicationState.healthy =
        nextHealthState;

    applicationState.lastHealthCheck =
        now();

    events?.emit?.(
        "application.health.changed",
        {

            previousHealthy:
                previousHealthState,

            healthy:
                nextHealthState,

            timestamp:
                applicationState
                    .lastHealthCheck
                    .toISOString()

        }
    );

    if (
        previousHealthState !==
        nextHealthState
    ) {

        logger?.info?.({

            section:
                "health",

            healthy:
                nextHealthState

        });

    }

}

// =============================================================================
// Application Shutdown
// =============================================================================

function markApplicationShutdown(
    events,
    logger
) {

    if (
        applicationState.terminated ||
        applicationState.stopped
    ) {

        return;

    }

    if (
        applicationState.shuttingDown
    ) {

        return;

    }

    const timestamp =
        now();

    applicationState.shuttingDown =
        true;

    applicationState.ready =
        false;

    applicationState.healthy =
        false;

    applicationState.shutdownStartedAt =
        timestamp;

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.SHUTTING_DOWN,
        events,
        logger
    );

    events?.emit?.(
        "application.shutdown",
        {

            timestamp:
                timestamp.toISOString()

        }
    );

    logger?.info?.({

        section:
            "runtime",

        state:
            "shutting_down"

    });

}

// =============================================================================
// Application Stopped
// =============================================================================

function markApplicationStopped(
    events,
    logger
) {

    if (
        applicationState.stopped ||
        applicationState.terminated
    ) {

        return;

    }

    if (
        applicationState.shuttingDown !==
        true
    ) {

        throw new Error(
            "Application must enter shutting_down before stopped."
        );

    }

    const timestamp =
        now();

    applicationState.started =
        false;

    applicationState.starting =
        false;

    applicationState.ready =
        false;

    applicationState.healthy =
        false;

    applicationState.shuttingDown =
        false;

    applicationState.stopped =
        true;

    applicationState.terminated =
        true;

    applicationState.stoppedAt =
        timestamp;

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.STOPPED,
        events,
        logger
    );

    events?.emit?.(
        "application.stopped",
        {

            timestamp:
                timestamp.toISOString()

        }
    );

    logger?.info?.({

        section:
            "runtime",

        state:
            "stopped"

    });

}

// =============================================================================
// Service State
// =============================================================================

function setServiceState(
    service,
    state,
    events,
    logger
) {

    assertValidService(
        service
    );

    assertValidServiceState(
        state
    );

    const previousState =
        applicationState.serviceStates[
            service
        ];

    applicationState.serviceStates[
        service
    ] =
        state;

    applicationState.services[
        service
    ] =
        state ===
        SERVICE_STATES.READY;

    const timestamp =
        now();

    events?.emit?.(
        "service.state.changed",
        {

            service,

            previousState,

            state,

            timestamp:
                timestamp.toISOString()

        }
    );

    logger?.info?.({

        section:
            "service",

        service,

        previousState,

        state

    });

}

// =============================================================================
// Service Starting
// =============================================================================

function markServiceStarting(
    service,
    events,
    logger
) {

    setServiceState(

        service,

        SERVICE_STATES.STARTING,

        events,

        logger

    );

}

// =============================================================================
// Service Ready
// =============================================================================

function markServiceReady(
    service,
    events,
    logger
) {

    setServiceState(

        service,

        SERVICE_STATES.READY,

        events,

        logger

    );

}

// =============================================================================
// Service Degraded
// =============================================================================

function markServiceDegraded(
    service,
    events,
    logger
) {

    setServiceState(

        service,

        SERVICE_STATES.DEGRADED,

        events,

        logger

    );

}

// =============================================================================
// Service Failed
// =============================================================================

function markServiceFailed(
    service,
    error,
    events,
    logger
) {

    setServiceState(

        service,

        SERVICE_STATES.FAILED,

        events,

        logger

    );

    events?.emit?.(
        "service.failed",
        {

            service,

            error: {

                message:
                    error?.message ||
                    String(error)

            },

            timestamp:
                now().toISOString()

        }
    );

}

// =============================================================================
// Request Metrics
// =============================================================================

function incrementActiveRequests() {

    applicationState.requestCount +=
        1;

    applicationState.activeRequests +=
        1;

}

function decrementActiveRequests() {

    applicationState.activeRequests =
        Math.max(

            0,

            applicationState.activeRequests -
                1

        );

}

// =============================================================================
// WebSocket Metrics
// =============================================================================

function incrementSocketConnections() {

    applicationState.websocketConnections +=
        1;

}

function decrementSocketConnections() {

    applicationState.websocketConnections =
        Math.max(

            0,

            applicationState.websocketConnections -
                1

        );

}

// =============================================================================
// Uptime
// =============================================================================

function getUptime() {

    return process.uptime();

}

// =============================================================================
// Readiness
// =============================================================================

function isReady() {

    return (

        applicationState.started ===
            true &&

        applicationState.ready ===
            true &&

        applicationState.healthy ===
            true &&

        applicationState.shuttingDown ===
            false &&

        applicationState.failed ===
            false

    );

}

// =============================================================================
// Liveness
// =============================================================================

function isLive() {

    return (
        applicationState.terminated !==
        true
    );

}

// =============================================================================
// Health Snapshot
// =============================================================================

function getHealthState() {

    return {

        live:
            isLive(),

        ready:
            isReady(),

        healthy:
            applicationState.healthy,

        started:
            applicationState.started,

        starting:
            applicationState.starting,

        failed:
            applicationState.failed,

        shuttingDown:
            applicationState.shuttingDown,

        stopped:
            applicationState.stopped,

        phase:
            applicationState.bootstrapPhase,

        lastHealthCheck:
            applicationState
                .lastHealthCheck
                ?.toISOString() ||
            null

    };

}

// =============================================================================
// Failure Handling
// =============================================================================
//
// Only safe diagnostic information is retained.
//
// Do not persist stack traces, tokens, credentials, request bodies, or secrets
// in the global runtime state.
// =============================================================================

function markFailed(
    error,
    events,
    logger
) {

    const timestamp =
        now();

    applicationState.failed =
        true;

    applicationState.starting =
        false;

    applicationState.started =
        false;

    applicationState.ready =
        false;

    applicationState.healthy =
        false;

    applicationState.failure = {

        message:
            error?.message ||
            String(error),

        code:
            error?.code ||
            null,

        phase:
            applicationState.bootstrapPhase,

        at:
            timestamp.toISOString()

    };

    events?.emit?.(
        "application.failed",
        {

            message:
                applicationState.failure.message,

            code:
                applicationState.failure.code,

            phase:
                applicationState.failure.phase,

            timestamp:
                applicationState.failure.at

        }
    );

    logger?.error?.({

        section:
            "runtime",

        state:
            "failed",

        message:
            applicationState.failure.message,

        code:
            applicationState.failure.code,

        phase:
            applicationState.failure.phase

    });

}

// =============================================================================
// Safe Application State Snapshot
// =============================================================================

function getApplicationState() {

    return {

        initialized:
            applicationState.initialized,

        starting:
            applicationState.starting,

        started:
            applicationState.started,

        healthy:
            applicationState.healthy,

        ready:
            applicationState.ready,

        shuttingDown:
            applicationState.shuttingDown,

        stopped:
            applicationState.stopped,

        terminated:
            applicationState.terminated,

        failed:
            applicationState.failed,

        bootstrapPhase:
            applicationState.bootstrapPhase,

        completedPhases: [

            ...applicationState.completedPhases

        ],

        startedAt:
            applicationState
                .startedAt
                ?.toISOString() ||
            null,

        readyAt:
            applicationState
                .readyAt
                ?.toISOString() ||
            null,

        shutdownStartedAt:
            applicationState
                .shutdownStartedAt
                ?.toISOString() ||
            null,

        stoppedAt:
            applicationState
                .stoppedAt
                ?.toISOString() ||
            null,

        lastHealthCheck:
            applicationState
                .lastHealthCheck
                ?.toISOString() ||
            null,

        uptime:
            getUptime(),

        totalRequests:
            applicationState.requestCount,

        activeRequests:
            applicationState.activeRequests,

        websocketConnections:
            applicationState.websocketConnections,

        services: {

            ...applicationState.services

        },

        serviceStates: {

            ...applicationState.serviceStates

        },

        health:
            getHealthState(),

        failure:
            applicationState.failure
                ? {
                    ...applicationState.failure
                }
                : null

    };

}

// =============================================================================
// Reset Runtime State
// =============================================================================
//
// Intended primarily for tests.
//
// =============================================================================

function resetApplicationState() {

    applicationState.initialized =
        false;

    applicationState.starting =
        false;

    applicationState.started =
        false;

    applicationState.healthy =
        false;

    applicationState.ready =
        false;

    applicationState.shuttingDown =
        false;

    applicationState.stopped =
        false;

    applicationState.terminated =
        false;

    applicationState.failed =
        false;

    applicationState.bootstrapPhase =
        null;

    applicationState.completedPhases =
        [];

    applicationState.startedAt =
        null;

    applicationState.readyAt =
        null;

    applicationState.shutdownStartedAt =
        null;

    applicationState.stoppedAt =
        null;

    applicationState.lastHealthCheck =
        null;

    applicationState.failure =
        null;

    applicationState.requestCount =
        0;

    applicationState.activeRequests =
        0;

    applicationState.websocketConnections =
        0;

    applicationState.services =
        createInitialServices();

    applicationState.serviceStates =
        createInitialServiceStates();

}

// =============================================================================
// Public API
// =============================================================================

module.exports = {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    BOOTSTRAP_PHASES,

    BOOTSTRAP_PHASE_ORDER,

    BOOTSTRAP_TRANSITIONS,

    SERVICES,

    SERVICE_STATES,

    // -------------------------------------------------------------------------
    // Backward-compatible internal state export
    // -------------------------------------------------------------------------
    //
    // Prefer getApplicationState() for consumers.
    //
    // -------------------------------------------------------------------------

    applicationState,

    // -------------------------------------------------------------------------
    // Bootstrap lifecycle
    // -------------------------------------------------------------------------

    updateBootstrapPhase,

    markPhaseStarted,

    markPhaseCompleted,

    // -------------------------------------------------------------------------
    // Application lifecycle
    // -------------------------------------------------------------------------

    markStarting,

    markApplicationStarted,

    markApplicationReady,

    markApplicationShutdown,

    markApplicationStopped,

    markFailed,

    // -------------------------------------------------------------------------
    // Health/readiness/liveness
    // -------------------------------------------------------------------------

    markHealthCheck,

    isReady,

    isLive,

    getHealthState,

    // -------------------------------------------------------------------------
    // Services
    // -------------------------------------------------------------------------

    setServiceState,

    markServiceStarting,

    markServiceReady,

    markServiceDegraded,

    markServiceFailed,

    // -------------------------------------------------------------------------
    // Metrics
    // -------------------------------------------------------------------------

    incrementActiveRequests,

    decrementActiveRequests,

    incrementSocketConnections,

    decrementSocketConnections,

    getUptime,

    // -------------------------------------------------------------------------
    // State inspection/testing
    // -------------------------------------------------------------------------

    getApplicationState,

    resetApplicationState

};