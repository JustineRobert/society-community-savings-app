"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Runtime Event Bus
 *
 * File: backend/runtime/events.js
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Centralized process-local event bus
 * ✓ Runtime lifecycle events
 * ✓ Bootstrap phase events
 * ✓ Service state events
 * ✓ Health/readiness events
 * ✓ Application shutdown events
 * ✓ Request / WebSocket observability events
 * ✓ Async listener rejection handling
 * ✓ Event listener protection
 * ✓ Safe event emission helpers
 * ✓ Production-safe error handling
 * ✓ Test reset support
 *
 * Design Principles
 * -----------------------------------------------------------------------------
 * - Runtime events are process-local.
 * - Events are notifications, not state storage.
 * - Event payloads must remain serializable.
 * - Event listeners must not mutate runtime state directly.
 * - Async listener failures must be observable.
 * - Event emission must never crash the application.
 * - Listener registration should be controlled.
 * - The event bus must remain independent of HTTP/framework code.
 * =============================================================================
 */

const {
    EventEmitter
} = require("events");

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DEFAULT_MAX_LISTENERS = 250;

const EVENT_ERROR = "error";

const IS_PRODUCTION =
    process.env.NODE_ENV === "production";

// -----------------------------------------------------------------------------
// Runtime Event Bus
// -----------------------------------------------------------------------------

const runtimeEvents =
    new EventEmitter({
        captureRejections: true
    });

runtimeEvents.setMaxListeners(
    DEFAULT_MAX_LISTENERS
);

// -----------------------------------------------------------------------------
// Event Statistics
// -----------------------------------------------------------------------------

const eventStatistics = {

    emitted: 0,

    errors: 0,

    rejected: 0,

    lastEvent: null,

    lastEventAt: null,

    lastErrorAt: null

};

// -----------------------------------------------------------------------------
// Internal Event Metadata
// -----------------------------------------------------------------------------

function createEventMetadata(
    eventName
) {

    return {

        event: eventName,

        timestamp:
            new Date().toISOString(),

        pid:
            process.pid

    };

}

// -----------------------------------------------------------------------------
// Safe Error Serialization
// -----------------------------------------------------------------------------

function serializeError(error) {

    if (!error) {
        return null;
    }

    return {

        name:
            error.name ||
            "Error",

        message:
            error.message ||
            String(error),

        code:
            error.code ||
            null,

        stack:
            IS_PRODUCTION
                ? undefined
                : error.stack

    };

}

// -----------------------------------------------------------------------------
// Event Error Handler
// -----------------------------------------------------------------------------
//
// IMPORTANT:
//
// EventEmitter treats an unhandled "error" event as fatal.
//
// This handler prevents runtime event listener failures from terminating
// the TITech application process.
//
// -----------------------------------------------------------------------------

runtimeEvents.on(
    EVENT_ERROR,
    error => {

        eventStatistics.errors += 1;

        eventStatistics.lastErrorAt =
            new Date();

        console.error(
            "[TITech:RUNTIME-EVENT]",
            serializeError(error)
        );

    }
);

// -----------------------------------------------------------------------------
// Async Rejection Handler
// -----------------------------------------------------------------------------
//
// captureRejections converts rejected promises returned by async listeners
// into "error" events.
//
// This listener provides an additional observable signal.
//
// -----------------------------------------------------------------------------

runtimeEvents.on(
    "runtime.event.rejected",
    payload => {

        eventStatistics.rejected += 1;

        console.error(
            "[TITech:RUNTIME-EVENT-REJECTED]",
            payload
        );

    }
);

// -----------------------------------------------------------------------------
// Emit Event
// -----------------------------------------------------------------------------
//
// Centralized emission ensures:
//
// ✓ Event statistics
// ✓ Timestamp tracking
// ✓ Consistent metadata
// ✓ Safe synchronous emission
//
// -----------------------------------------------------------------------------

function emitEvent(
    eventName,
    payload = {}
) {

    if (
        typeof eventName !==
        "string" ||
        !eventName.trim()
    ) {

        throw new TypeError(
            "Event name must be a non-empty string."
        );

    }

    const metadata =
        createEventMetadata(
            eventName
        );

    const eventPayload = {

        ...payload,

        _meta: metadata

    };

    eventStatistics.emitted += 1;

    eventStatistics.lastEvent =
        eventName;

    eventStatistics.lastEventAt =
        new Date();

    try {

        runtimeEvents.emit(
            eventName,
            eventPayload
        );

        return true;

    } catch (error) {

        eventStatistics.errors += 1;

        eventStatistics.lastErrorAt =
            new Date();

        console.error(
            "[TITech:RUNTIME-EVENT-EMIT]",
            serializeError(error)
        );

        return false;

    }

}

// -----------------------------------------------------------------------------
// Safe Listener Registration
// -----------------------------------------------------------------------------

function onEvent(
    eventName,
    listener
) {

    if (
        typeof eventName !==
        "string" ||
        !eventName.trim()
    ) {

        throw new TypeError(
            "Event name must be a non-empty string."
        );

    }

    if (
        typeof listener !==
        "function"
    ) {

        throw new TypeError(
            "Event listener must be a function."
        );

    }

    runtimeEvents.on(
        eventName,
        listener
    );

    return () => {

        runtimeEvents.off(
            eventName,
            listener
        );

    };

}

// -----------------------------------------------------------------------------
// One-Time Listener
// -----------------------------------------------------------------------------

function onceEvent(
    eventName,
    listener
) {

    if (
        typeof eventName !==
        "string" ||
        !eventName.trim()
    ) {

        throw new TypeError(
            "Event name must be a non-empty string."
        );

    }

    if (
        typeof listener !==
        "function"
    ) {

        throw new TypeError(
            "Event listener must be a function."
        );

    }

    runtimeEvents.once(
        eventName,
        listener
    );

    return () => {

        runtimeEvents.off(
            eventName,
            listener
        );

    };

}

// -----------------------------------------------------------------------------
// Event Statistics Snapshot
// -----------------------------------------------------------------------------

function getEventStatistics() {

    return {

        emitted:
            eventStatistics.emitted,

        errors:
            eventStatistics.errors,

        rejected:
            eventStatistics.rejected,

        lastEvent:
            eventStatistics.lastEvent,

        lastEventAt:
            eventStatistics.lastEventAt
                ?.toISOString() ||
            null,

        lastErrorAt:
            eventStatistics.lastErrorAt
                ?.toISOString() ||
            null,

        listenerCount:
            runtimeEvents
                .eventNames()
                .reduce(
                    (
                        total,
                        eventName
                    ) =>
                        total +
                        runtimeEvents
                            .listenerCount(
                                eventName
                            ),
                    0
                )

    };

}

// -----------------------------------------------------------------------------
// Event Names
// -----------------------------------------------------------------------------
//
// Centralizing event names prevents typo-driven observability failures.
//
// -----------------------------------------------------------------------------

const RUNTIME_EVENTS =
    Object.freeze({

        // Application lifecycle
        APPLICATION_READY:
            "application.ready",

        APPLICATION_HEALTH_CHANGED:
            "application.health.changed",

        APPLICATION_SHUTDOWN:
            "application.shutdown",

        APPLICATION_STOPPED:
            "application.stopped",

        // Bootstrap
        BOOTSTRAP_PHASE_CHANGED:
            "bootstrap.phase.changed",

        // Services
        SERVICE_STATE_CHANGED:
            "service.state.changed",

        // Requests
        REQUEST_STARTED:
            "request.started",

        REQUEST_COMPLETED:
            "request.completed",

        REQUEST_FAILED:
            "request.failed",

        // WebSocket
        WEBSOCKET_CONNECTED:
            "websocket.connected",

        WEBSOCKET_DISCONNECTED:
            "websocket.disconnected",

        // Authentication
        AUTHENTICATION_LOGIN:
            "authentication.login",

        AUTHENTICATION_LOGOUT:
            "authentication.logout",

        AUTHENTICATION_REFRESH:
            "authentication.refresh",

        // Financial operations
        FINANCIAL_OPERATION_STARTED:
            "financial.operation.started",

        FINANCIAL_OPERATION_COMPLETED:
            "financial.operation.completed",

        FINANCIAL_OPERATION_FAILED:
            "financial.operation.failed",

        // Offline/synchronization
        OFFLINE_ENTERED:
            "offline.entered",

        ONLINE_RESTORED:
            "online.restored",

        SYNC_STARTED:
            "sync.started",

        SYNC_COMPLETED:
            "sync.completed",

        SYNC_FAILED:
            "sync.failed",

        // Internal event failures
        RUNTIME_EVENT_REJECTED:
            "runtime.event.rejected"

    });

// -----------------------------------------------------------------------------
// Reset Statistics
// -----------------------------------------------------------------------------
//
// Primarily intended for automated tests.
//
// -----------------------------------------------------------------------------

function resetEventStatistics() {

    eventStatistics.emitted = 0;

    eventStatistics.errors = 0;

    eventStatistics.rejected = 0;

    eventStatistics.lastEvent = null;

    eventStatistics.lastEventAt = null;

    eventStatistics.lastErrorAt = null;

}

// -----------------------------------------------------------------------------
// Remove Runtime Listeners
// -----------------------------------------------------------------------------
//
// Primarily intended for tests and controlled application shutdown.
//
// -----------------------------------------------------------------------------

function removeAllRuntimeListeners() {

    runtimeEvents.removeAllListeners();

}

// -----------------------------------------------------------------------------
// Reset Runtime Event Bus
// -----------------------------------------------------------------------------
//
// Test-only utility.
//
// -----------------------------------------------------------------------------

function resetRuntimeEvents() {

    removeAllRuntimeListeners();

    resetEventStatistics();

    runtimeEvents.setMaxListeners(
        DEFAULT_MAX_LISTENERS
    );

    // Restore the mandatory error handler.

    runtimeEvents.on(
        EVENT_ERROR,
        error => {

            eventStatistics.errors += 1;

            eventStatistics.lastErrorAt =
                new Date();

            console.error(
                "[TITech:RUNTIME-EVENT]",
                serializeError(error)
            );

        }
    );

}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

module.exports = {

    runtimeEvents,

    RUNTIME_EVENTS,

    emitEvent,

    onEvent,

    onceEvent,

    getEventStatistics,

    resetEventStatistics,

    resetRuntimeEvents,

    DEFAULT_MAX_LISTENERS

};