"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/app.js
 *
 * Purpose:
 *   Enterprise application bootstrap/orchestration boundary.
 *
 * Architectural Responsibility
 * =============================================================================
 *
 *   This module owns STARTUP and SHUTDOWN orchestration.
 *
 *   It does NOT own:
 *
 *      - Express application implementation
 *      - middleware implementation
 *      - business logic
 *      - repository logic
 *      - financial transaction logic
 *
 *   backend/app.js owns the Express application factory.
 *
 *   backend/bootstrap/app.js owns:
 *
 *      configuration
 *          ↓
 *      logger
 *          ↓
 *      observability
 *          ↓
 *      resilience
 *          ↓
 *      database
 *          ↓
 *      middleware
 *          ↓
 *      routes
 *          ↓
 *      server
 *
 * =============================================================================
 *
 * Canonical Startup Pipeline
 * =============================================================================
 *
 *      environment
 *          ↓
 *      configuration
 *          ↓
 *      logger
 *          ↓
 *      observability
 *          ↓
 *      resilience
 *          ↓
 *      database
 *          ↓
 *      middleware
 *          ↓
 *      routes
 *          ↓
 *      server
 *          ↓
 *      READY
 *
 * =============================================================================
 *
 * Canonical Shutdown Pipeline
 * =============================================================================
 *
 *      READY
 *        ↓
 *      SHUTTING_DOWN
 *        ↓
 *      stop HTTP server
 *        ↓
 *      stop realtime / auxiliary services
 *        ↓
 *      close database
 *        ↓
 *      close other infrastructure
 *        ↓
 *      STOPPED
 *
 * =============================================================================
 *
 * IMPORTANT
 * =============================================================================
 *
 *   This file is the ONLY place that should decide the order in which the
 *   major application subsystems are initialized.
 *
 * =============================================================================
 */

const http =
    require("http");

const configuration =
    require("../config");

const app =
    require("../app");

const {
    BOOTSTRAP_PHASES,
    getApplicationState,
    markStarting,
    markPhaseStarted,
    markPhaseCompleted,
    markApplicationStarted,
    markApplicationReady,
    markApplicationShutdown,
    markApplicationStopped,
    markFailed,
    setServiceState,
    getHealthState
} = require("../runtime/state");

const {
    registerMiddleware
} = require("./middleware");

// =============================================================================
// Optional/Internal Dependencies
// =============================================================================

let bootstrapResilienceObservability =
    null;

let bootstrapResilience =
    null;

let connectDatabase =
    null;

let closeDatabase =
    null;

let loggerModule =
    null;

let redisService =
    null;

let socketService =
    null;

// =============================================================================
// Dependency Loading
// =============================================================================
//
// The bootstrap layer attempts to load infrastructure modules without
// initializing them merely by requiring this file.
//
// =============================================================================

function loadOptionalDependencies() {

    try {

        const module =
            require(
                "../observability/resilienceObservabilityBootstrap"
            );

        bootstrapResilienceObservability =
            module?.bootstrapResilienceObservability ||
            null;

    } catch (
        error
    ) {

        bootstrapResilienceObservability =
            null;

    }

    try {

        const module =
            require(
                "../middleware/resilience/runtime/resilienceBootstrap"
            );

        bootstrapResilience =
            module?.bootstrapResilience ||
            null;

    } catch (
        error
    ) {

        bootstrapResilience =
            null;

    }

    try {

        const module =
            require(
                "../config/db"
            );

        /*
         * Existing project convention is connectDB.
         *
         * Support either:
         *
         *     module.exports = connectDB
         *
         * or:
         *
         *     module.exports = { connectDB, closeDB }
         */
        if (
            typeof module ===
            "function"
        ) {

            connectDatabase =
                module;

        } else {

            connectDatabase =
                module?.connectDB ||
                module?.connectDatabase ||
                null;

            closeDatabase =
                module?.closeDB ||
                module?.closeDatabase ||
                module?.disconnectDB ||
                null;

        }

    } catch (
        error
    ) {

        connectDatabase =
            null;

    }

    try {

        loggerModule =
            require(
                "../utils/logger"
            );

    } catch (
        error
    ) {

        loggerModule =
            null;

    }

    try {

        redisService =
            require(
                "../services/redis"
            );

    } catch (
        error
    ) {

        redisService =
            null;

    }

    try {

        socketService =
            require(
                "../services/socket"
            );

    } catch (
        error
    ) {

        socketService =
            null;

    }

}

// =============================================================================
// Logger Resolution
// =============================================================================

function resolveLogger() {

    if (
        loggerModule
    ) {

        if (
            typeof loggerModule ===
            "function"
        ) {

            return {
                info:
                    loggerModule,

                warn:
                    loggerModule,

                error:
                    loggerModule,

                debug:
                    loggerModule
            };

        }

        if (
            loggerModule.logger
        ) {

            return loggerModule.logger;

        }

        if (
            loggerModule.default
        ) {

            return loggerModule.default;

        }

        if (
            typeof loggerModule.info ===
                "function" ||
            typeof loggerModule.warn ===
                "function" ||
            typeof loggerModule.error ===
                "function"
        ) {

            return loggerModule;

        }

    }

    /*
     * Fallback logger.
     *
     * Bootstrap must remain functional even before the application logger
     * subsystem is available.
     */

    return {

        info:
            console.info.bind(
                console
            ),

        warn:
            console.warn.bind(
                console
            ),

        error:
            console.error.bind(
                console
            ),

        debug:
            console.debug.bind(
                console
            )

    };

}

loadOptionalDependencies();

const logger =
    resolveLogger();

// =============================================================================
// Runtime Variables
// =============================================================================

let server =
    null;

let startupPromise =
    null;

let shutdownPromise =
    null;

let signalHandlersInstalled =
    false;

let startupCompleted =
    false;

let shutdownCompleted =
    false;

// =============================================================================
// Utility: Error Normalization
// =============================================================================

function normalizeError(
    error
) {

    if (
        error instanceof Error
    ) {

        return error;

    }

    const normalized =
        new Error(
            error?.message ||
            String(error)
        );

    if (
        error?.code
    ) {

        normalized.code =
            error.code;

    }

    return normalized;

}

// =============================================================================
// Utility: Phase Runner
// =============================================================================

async function runPhase({

    phase,

    execute,

    service = null

}) {

    markPhaseStarted(
        phase,
        null,
        logger
    );

    if (
        service
    ) {

        setServiceState(

            service,

            "starting",

            null,

            logger

        );

    }

    try {

        const result =
            await execute();

        if (
            service
        ) {

            setServiceState(

                service,

                "ready",

                null,

                logger

            );

        }

        markPhaseCompleted(
            phase,
            null,
            logger
        );

        return result;

    } catch (
        error
    ) {

        if (
            service
        ) {

            setServiceState(

                service,

                "failed",

                null,

                logger

            );

        }

        throw error;

    }

}

// =============================================================================
// Environment Phase
// =============================================================================

async function bootstrapEnvironment() {

    /*
     * configuration/index.js already loads and validates environment
     * variables.
     *
     * This phase verifies that the resolved configuration is usable.
     */

    if (
        !configuration ||
        !configuration.environment
    ) {

        throw new Error(
            "Application environment configuration is unavailable."
        );

    }

    if (
        !Number.isInteger(
            configuration.port
        )
    ) {

        throw new Error(
            "Application port configuration is invalid."
        );

    }

    return {

        environment:
            configuration.environment,

        port:
            configuration.port

    };

}

// =============================================================================
// Configuration Phase
// =============================================================================

async function bootstrapConfiguration() {

    /*
     * Configuration is already normalized by backend/config/index.js.
     *
     * This phase intentionally does not mutate configuration.
     */

    if (
        Object.isFrozen(
            configuration
        ) !== true
    ) {

        throw new Error(
            "Application configuration must be immutable."
        );

    }

    return configuration;

}

// =============================================================================
// Logger Phase
// =============================================================================

async function bootstrapLogger() {

    if (
        !logger ||
        typeof logger.info !==
            "function"
    ) {

        throw new Error(
            "Application logger is unavailable."
        );

    }

    logger.info({

        section:
            "bootstrap",

        phase:
            "logger",

        service:
            configuration.serviceName,

        environment:
            configuration.environment

    });

    return logger;

}

// =============================================================================
// Observability Phase
// =============================================================================

async function bootstrapObservability() {

    /*
     * The project already has a resilience/observability bootstrap module.
     *
     * If it exists, invoke it.
     *
     * Otherwise keep startup functional and continue with a degraded
     * observability state.
     */

    if (
        typeof bootstrapResilienceObservability !==
            "function"
    ) {

        logger.warn({

            section:
                "bootstrap",

            phase:
                "observability",

            message:
                "Observability bootstrap module is unavailable; continuing in degraded mode."

        });

        return {

            enabled:
                false

        };

    }

    const telemetry =
        await bootstrapResilienceObservability({

            prometheus:
                null,

            tracer:
                null,

            logger

        });

    return {

        enabled:
            true,

        telemetry

    };

}

// =============================================================================
// Resilience Phase
// =============================================================================

async function bootstrapResiliencePhase() {

    if (
        typeof bootstrapResilience !==
            "function"
    ) {

        logger.warn({

            section:
                "bootstrap",

            phase:
                "resilience",

            message:
                "Resilience bootstrap module is unavailable; continuing with base runtime."

        });

        return {

            enabled:
                false

        };

    }

    /*
     * Support a resilience bootstrap implementation that accepts a context.
     *
     * Existing implementations may ignore unused properties.
     */

    const resilience =
        await bootstrapResilience({

            configuration,

            logger,

            app,

            runtime: {

                getState:
                    getApplicationState

            }

        });

    return {

        enabled:
            true,

        resilience

    };

}

// =============================================================================
// Database Phase
// =============================================================================

async function bootstrapDatabase() {

    if (
        configuration.flags?.skipDbChecks
    ) {

        logger.warn({

            section:
                "bootstrap",

            phase:
                "database",

            message:
                "Database checks are explicitly disabled."

        });

        return {

            connected:
                false,

            skipped:
                true

        };

    }

    if (
        typeof connectDatabase !==
            "function"
    ) {

        throw new Error(
            "Database bootstrap function is unavailable."
        );

    }

    const result =
        await connectDatabase();

    return {

        connected:
            true,

        result

    };

}

// =============================================================================
// Middleware Phase
// =============================================================================

async function bootstrapMiddleware() {

    if (
        typeof registerMiddleware !==
            "function"
    ) {

        throw new Error(
            "registerMiddleware() is unavailable."
        );

    }

    registerMiddleware(
        app
    );

    return app;

}

// =============================================================================
// Routes
// =============================================================================
//
// Route registration belongs to backend/routes/index.js.
//
// backend/bootstrap/app.js owns the ROUTES lifecycle phase only.
// It does not own individual API or health endpoint definitions.
//
// =============================================================================

async function bootstrapRoutes() {

    const {
        registerRoutes
    } = require(
        "../routes"
    );

    registerRoutes(
        app
    );

    return app;

}

// =============================================================================
// Runtime Readiness
// =============================================================================

function isRuntimeReady() {

    const state =
        getApplicationState();

    return (

        state.started ===
            true &&

        state.healthy ===
            true &&

        state.shuttingDown !==
            true &&

        state.failed !==
            true &&

        state.bootstrapPhase ===
            BOOTSTRAP_PHASES.READY

    );

}

// =============================================================================
// Server Phase
// =============================================================================

async function bootstrapServer() {

    if (
        server
    ) {

        return server;

    }

    server =
        http.createServer(
            app
        );

    /*
     * Keep connection timeouts centralized in configuration.
     */

    if (
        Number.isFinite(
            configuration.timeouts?.keepAlive
        )
    ) {

        server.keepAliveTimeout =
            configuration.timeouts
                .keepAlive;

    }

    if (
        Number.isFinite(
            configuration.timeouts?.headers
        )
    ) {

        server.headersTimeout =
            configuration.timeouts
                .headers;

    }

    /*
     * Express itself does not own the server error listener.
     * The bootstrap layer does.
     */

    server.on(
        "error",
        error => {

            logger.error({

                section:
                    "server",

                event:
                    "error",

                error: {

                    message:
                        error.message,

                    code:
                        error.code,

                    stack:
                        error.stack

                }

            });

        }
    );

    /*
     * Listen only here.
     */

    await new Promise(
        (
            resolve,
            reject
        ) => {

            const onError =
                error => {

                    server.off(
                        "listening",
                        onListening
                    );

                    reject(
                        error
                    );

                };

            const onListening =
                () => {

                    server.off(
                        "error",
                        onError
                    );

                    resolve();

                };

            server.once(
                "error",
                onError
            );

            server.once(
                "listening",
                onListening
            );

            server.listen(
                configuration.port,
                "0.0.0.0"
            );

        }
    );

    const address =
        server.address();

    logger.info({

        section:
            "server",

        event:
            "listening",

        address:
            typeof address ===
                "string"
                ? address
                : address?.address,

        port:
            typeof address ===
                "object"
                ? address.port
                : configuration.port,

        environment:
            configuration.environment

    });

    return server;

}

// =============================================================================
// Close HTTP Server
// =============================================================================

async function closeHttpServer() {

    if (
        !server
    ) {

        return;

    }

    const activeServer =
        server;

    server =
        null;

    await new Promise(
        resolve => {

            let settled =
                false;

            const finish =
                () => {

                    if (
                        settled
                    ) {

                        return;

                    }

                    settled =
                        true;

                    resolve();

                };

            activeServer.close(
                finish
            );

            const timeoutMs =
                Number(
                    configuration
                        .timeouts
                        ?.shutdown
                ) ||
                10000;

            setTimeout(
                finish,
                timeoutMs
            ).unref?.();

        }
    );

}

// =============================================================================
// Close Redis
// =============================================================================

async function closeRedis() {

    if (
        !redisService
    ) {

        return;

    }

    const closeFunction =
        redisService.shutdown ||
        redisService.close ||
        redisService.disconnect ||
        redisService.quit;

    if (
        typeof closeFunction !==
            "function"
    ) {

        return;

    }

    await closeFunction.call(
        redisService
    );

}

// =============================================================================
// Close Socket Service
// =============================================================================

async function closeSocketService() {

    if (
        !socketService
    ) {

        return;

    }

    const closeFunction =
        socketService.shutdown ||
        socketService.close ||
        socketService.stop;

    if (
        typeof closeFunction !==
            "function"
    ) {

        return;

    }

    await closeFunction.call(
        socketService
    );

}

// =============================================================================
// Close Database
// =============================================================================

async function shutdownDatabase() {

    if (
        typeof closeDatabase !==
            "function"
    ) {

        /*
         * Fall back to Mongoose disconnect if the project database module does
         * not expose an explicit shutdown function.
         */

        try {

            const mongoose =
                require(
                    "mongoose"
                );

            if (
                mongoose.connection
                    .readyState !==
                0
            ) {

                await mongoose.disconnect();

            }

        } catch (
            error
        ) {

            logger.warn({

                section:
                    "database",

                event:
                    "shutdown-fallback-failed",

                message:
                    error.message

            });

        }

        return;

    }

    await closeDatabase();

}

// =============================================================================
// Bootstrap Context
// =============================================================================

function createBootstrapContext() {

    return {

        app,

        configuration,

        logger,

        server: () =>
            server,

        getRuntimeState:
            getApplicationState,

        getHealthState,

        bootstrapEnvironment,

        bootstrapConfiguration,

        bootstrapLogger,

        bootstrapObservability,

        bootstrapResiliencePhase,

        bootstrapDatabase,

        bootstrapMiddleware,

        bootstrapRoutes,

        bootstrapServer

    };

}

// =============================================================================
// Startup
// =============================================================================

async function startApplication() {

    if (
        startupPromise
    ) {

        return startupPromise;

    }

    if (
        startupCompleted
    ) {

        return {

            app,

            server,

            state:
                getApplicationState()

        };

    }

    startupPromise =
        (async () => {

            markStarting(
                null,
                logger
            );

            const context =
                createBootstrapContext();

            try {

                // =============================================================
                // Environment
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.ENVIRONMENT,

                    execute:
                        context
                            .bootstrapEnvironment

                });

                // =============================================================
                // Configuration
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.CONFIGURATION,

                    execute:
                        context
                            .bootstrapConfiguration

                });

                // =============================================================
                // Logger
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.LOGGER,

                    service:
                        "logger",

                    execute:
                        context
                            .bootstrapLogger

                });

                // =============================================================
                // Observability
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.OBSERVABILITY,

                    service:
                        "observability",

                    execute:
                        context
                            .bootstrapObservability

                });

                // =============================================================
                // Resilience
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.RESILIENCE,

                    service:
                        "resilience",

                    execute:
                        context
                            .bootstrapResiliencePhase

                });

                // =============================================================
                // Database
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.DATABASE,

                    service:
                        "database",

                    execute:
                        context
                            .bootstrapDatabase

                });

                // =============================================================
                // Middleware
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.MIDDLEWARE,

                    service:
                        "middleware",

                    execute:
                        context
                            .bootstrapMiddleware

                });

                // =============================================================
                // Routes
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.ROUTES,

                    service:
                        "routes",

                    execute:
                        async () =>
                            context
                                .bootstrapRoutes()

                });

                // =============================================================
                // Server
                // =============================================================

                await runPhase({

                    phase:
                        BOOTSTRAP_PHASES.SERVER,

                    service:
                        "server",

                    execute:
                        context
                            .bootstrapServer

                });

                // =============================================================
                // Application Started
                // =============================================================

                markApplicationStarted(
                    null,
                    logger
                );

                // =============================================================
                // Application Ready
                // =============================================================

                markApplicationReady(
                    null,
                    logger
                );

                startupCompleted =
                    true;

                logger.info({

                    section:
                        "bootstrap",

                    event:
                        "application.ready",

                    service:
                        configuration.serviceName,

                    environment:
                        configuration.environment,

                    port:
                        configuration.port

                });

                return {

                    app,

                    server,

                    state:
                        getApplicationState(),

                    context

                };

            } catch (
                error
            ) {

                const normalizedError =
                    normalizeError(
                        error
                    );

                markFailed(
                    normalizedError,
                    null,
                    logger
                );

                logger.error({

                    section:
                        "bootstrap",

                    event:
                        "startup.failed",

                    phase:
                        getApplicationState()
                            .bootstrapPhase,

                    message:
                        normalizedError.message,

                    code:
                        normalizedError.code,

                    stack:
                        normalizedError.stack

                });

                /*
                 * Attempt cleanup after a failed startup.
                 */

                try {

                    await shutdownApplication(
                        {
                            reason:
                                "startup_failure",

                            exit:
                                false

                        }
                    );

                } catch (
                    shutdownError
                ) {

                    logger.error({

                        section:
                            "bootstrap",

                        event:
                            "startup.cleanup.failed",

                        message:
                            shutdownError.message

                    });

                }

                throw normalizedError;

            }

        })();

    try {

        return await startupPromise;

    } finally {

        startupPromise =
            null;

    }

}

// =============================================================================
// Shutdown
// =============================================================================

async function shutdownApplication({

    reason =
        "shutdown",

    exit =
        false,

    exitCode =
        0

} = {}) {

    if (
        shutdownPromise
    ) {

        return shutdownPromise;

    }

    shutdownPromise =
        (async () => {

            if (
                shutdownCompleted
            ) {

                return;

            }

            const currentState =
                getApplicationState();

            /*
             * Nothing was ever started.
             *
             * Avoid artificial shutdown transitions.
             */

            if (
                !currentState.started &&
                !currentState.starting &&
                !server
            ) {

                shutdownCompleted =
                    true;

                if (
                    exit
                ) {

                    process.exit(
                        exitCode
                    );

                }

                return;

            }

            try {

                markApplicationShutdown(
                    null,
                    logger
                );

            } catch (
                error
            ) {

                logger.warn({

                    section:
                        "shutdown",

                    event:
                        "state-transition-warning",

                    message:
                        error.message

                });

            }

            logger.info({

                section:
                    "shutdown",

                event:
                    "started",

                reason

            });

            /*
             * Stop accepting new HTTP traffic first.
             */

            try {

                await closeHttpServer();

            } catch (
                error
            ) {

                logger.error({

                    section:
                        "shutdown",

                    component:
                        "http-server",

                    message:
                        error.message

                });

            }

            /*
             * Close realtime infrastructure.
             */

            try {

                await closeSocketService();

            } catch (
                error
            ) {

                logger.error({

                    section:
                        "shutdown",

                    component:
                        "socket",

                    message:
                        error.message

                });

            }

            /*
             * Close Redis.
             */

            try {

                await closeRedis();

            } catch (
                error
            ) {

                logger.error({

                    section:
                        "shutdown",

                    component:
                        "redis",

                    message:
                        error.message

                });

            }

            /*
             * Close MongoDB last among infrastructure dependencies.
             */

            try {

                await shutdownDatabase();

            } catch (
                error
            ) {

                logger.error({

                    section:
                        "shutdown",

                    component:
                        "database",

                    message:
                        error.message

                });

            }

            try {

                markApplicationStopped(
                    null,
                    logger
                );

            } catch (
                error
            ) {

                logger.error({

                    section:
                        "shutdown",

                    event:
                        "state-transition-failed",

                    message:
                        error.message

                });

            }

            shutdownCompleted =
                true;

            logger.info({

                section:
                    "shutdown",

                event:
                    "completed",

                reason

            });

            if (
                exit
            ) {

                process.exit(
                    exitCode
                );

            }

        })();

    try {

        return await shutdownPromise;

    } finally {

        shutdownPromise =
            null;

    }

}

// =============================================================================
// Process Signal Handling
// =============================================================================
//
// Install once.
//
// =============================================================================

function installSignalHandlers() {

    if (
        signalHandlersInstalled
    ) {

        return;

    }

    signalHandlersInstalled =
        true;

    const handleSignal =
        signal =>
            async () => {

                logger.info({

                    section:
                        "process",

                    event:
                        "signal.received",

                    signal

                });

                try {

                    await shutdownApplication({

                        reason:
                            signal,

                        exit:
                            true,

                        exitCode:
                            0

                    });

                } catch (
                    error
                ) {

                    logger.error({

                        section:
                            "process",

                        event:
                            "shutdown.failed",

                        signal,

                        message:
                            error.message,

                        stack:
                            error.stack

                    });

                    process.exit(
                        1
                    );

                }

            };

    process.once(
        "SIGINT",
        handleSignal(
            "SIGINT"
        )
    );

    process.once(
        "SIGTERM",
        handleSignal(
            "SIGTERM"
        )
    );

}

// =============================================================================
// Fatal Error Handlers
// =============================================================================
//
// These handlers are intentionally conservative.
//
// An uncaught exception means process correctness can no longer be assumed.
// =============================================================================

function installFatalErrorHandlers() {

    process.on(

        "uncaughtException",

        async error => {

            logger.error({

                section:
                    "process",

                event:
                    "uncaughtException",

                message:
                    error.message,

                stack:
                    error.stack

            });

            try {

                markFailed(
                    error,
                    null,
                    logger
                );

                await shutdownApplication({

                    reason:
                        "uncaughtException",

                    exit:
                        true,

                    exitCode:
                        1

                });

            } catch (
                shutdownError
            ) {

                logger.error({

                    section:
                        "process",

                    event:
                        "fatal.shutdown.failed",

                    message:
                        shutdownError.message

                });

                process.exit(
                    1
                );

            }

        }

    );

    process.on(

        "unhandledRejection",

        async reason => {

            const error =
                normalizeError(
                    reason
                );

            logger.error({

                section:
                    "process",

                event:
                    "unhandledRejection",

                message:
                    error.message,

                stack:
                    error.stack

            });

            try {

                markFailed(
                    error,
                    null,
                    logger
                );

                await shutdownApplication({

                    reason:
                        "unhandledRejection",

                    exit:
                        true,

                    exitCode:
                        1

                });

            } catch (
                shutdownError
            ) {

                logger.error({

                    section:
                        "process",

                    event:
                        "fatal.shutdown.failed",

                    message:
                        shutdownError.message

                });

                process.exit(
                    1
                );

            }

        }

    );

}

// =============================================================================
// Bootstrap Context Export
// =============================================================================

const bootstrapContext =
    Object.freeze({

        app,

        configuration,

        logger,

        getServer:
            () =>
                server,

        getRuntimeState:
            getApplicationState,

        getHealthState,

        start:
            startApplication,

        shutdown:
            shutdownApplication,

        installSignalHandlers,

        installFatalErrorHandlers

    });

// =============================================================================
// Public API
// =============================================================================

module.exports = {

    app,

    configuration,

    logger,

    bootstrapContext,

    startApplication,

    shutdownApplication,

    installSignalHandlers,

    installFatalErrorHandlers,

    bootstrapEnvironment,

    bootstrapConfiguration,

    bootstrapLogger,

    bootstrapObservability,

    bootstrapResiliencePhase,

    bootstrapDatabase,

    bootstrapMiddleware,

    bootstrapRoutes,

    bootstrapServer,

    getRuntimeState:
        getApplicationState,

    getHealthState,

    isRuntimeReady

};

// =============================================================================
// Optional Direct Execution
// =============================================================================
//
// This allows:
//
//     node backend/bootstrap/app.js
//
// while still keeping `require("./bootstrap/app")` side-effect controlled.
//
// =============================================================================

if (
    require.main ===
    module
) {

    (async () => {

        installSignalHandlers();

        installFatalErrorHandlers();

        try {

            await startApplication();

        } catch (
            error
        ) {

            logger.error({

                section:
                    "bootstrap",

                event:
                    "fatal-startup-failure",

                message:
                    error.message,

                stack:
                    error.stack

            });

            process.exit(
                1
            );

        }

    })();

}