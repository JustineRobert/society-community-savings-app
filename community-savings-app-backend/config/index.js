"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/routes/index.js
 *
 * Purpose:
 *   Central enterprise HTTP route registration boundary.
 *
 * Architectural Position:
 *
 *   backend/bootstrap/app.js
 *             │
 *             ▼
 *       registerRoutes(app)
 *             │
 *      ┌──────┴───────┐
 *      ▼              ▼
 *   API Routes     Runtime Routes
 *
 * Responsibilities
 * =============================================================================
 *
 *   ✓ Register application API routes.
 *   ✓ Register health/readiness/liveness endpoints.
 *   ✓ Preserve centralized route prefixes.
 *   ✓ Keep route registration separate from middleware.
 *   ✓ Keep route registration separate from controllers.
 *   ✓ Keep route registration separate from business services.
 *   ✓ Provide one route-registration entry point for bootstrap.
 *
 * NOT INCLUDED
 * =============================================================================
 *
 *   ✗ Database initialization
 *   ✗ Redis initialization
 *   ✗ Queue initialization
 *   ✗ Socket.IO initialization
 *   ✗ Business logic
 *   ✗ Financial transaction orchestration
 *   ✗ Middleware registration
 *   ✗ HTTP server startup
 *
 * =============================================================================
 */

const {
    getApplicationState,
    getHealthState,
    isReady,
    isLive
} = require(
    "../runtime/state"
);

// =============================================================================
// Route Registration Helpers
// =============================================================================

function registerApiRoutes(
    app
) {

    // =========================================================================
    // Authentication
    // =========================================================================

    const authRoutes =
        require(
            "./auth"
        );

    app.use(
        "/api/auth",
        authRoutes
    );

    // =========================================================================
    // Legal
    // =========================================================================

    const legalRoutes =
        require(
            "./legal.routes"
        );

    app.use(
        "/api/legal",
        legalRoutes
    );

    // =========================================================================
    // Email
    // =========================================================================

    const emailRoutes =
        require(
            "./email"
        );

    app.use(
        "/api/email",
        emailRoutes
    );

}

// =============================================================================
// Health
// =============================================================================

function registerHealthRoutes(
    app
) {

    /*
     * -------------------------------------------------------------------------
     * Liveness
     * -------------------------------------------------------------------------
     *
     * Liveness must remain lightweight.
     *
     * It should answer whether the Node.js process is alive, without requiring
     * MongoDB, Redis, queues, or other external dependencies to be available.
     */

    app.get(
        "/live",
        (
            req,
            res
        ) => {

            const live =
                isLive();

            return res
                .status(
                    live
                        ? 200
                        : 503
                )
                .json({

                    success:
                        live,

                    alive:
                        live,

                    status:
                        live
                            ? "live"
                            : "stopped",

                    timestamp:
                        new Date()
                            .toISOString()

                });

        }
    );

    /*
     * -------------------------------------------------------------------------
     * Readiness
     * -------------------------------------------------------------------------
     *
     * Readiness means the application has completed its startup pipeline and
     * is prepared to accept traffic.
     */

    app.get(
        "/ready",
        (
            req,
            res
        ) => {

            const ready =
                isReady();

            const health =
                getHealthState();

            return res
                .status(
                    ready
                        ? 200
                        : 503
                )
                .json({

                    success:
                        ready,

                    ready,

                    status:
                        ready
                            ? "ready"
                            : "not_ready",

                    phase:
                        health.phase,

                    healthy:
                        health.healthy,

                    started:
                        health.started,

                    shuttingDown:
                        health.shuttingDown,

                    failed:
                        health.failed,

                    timestamp:
                        new Date()
                            .toISOString()

                });

        }
    );

    /*
     * -------------------------------------------------------------------------
     * General Health
     * -------------------------------------------------------------------------
     *
     * Health provides broader runtime information than liveness.
     */

    app.get(
        "/health",
        (
            req,
            res
        ) => {

            const health =
                getHealthState();

            const healthy =
                health.healthy &&
                !health.failed;

            return res
                .status(
                    healthy
                        ? 200
                        : 503
                )
                .json({

                    success:
                        healthy,

                    status:
                        healthy
                            ? "healthy"
                            : "degraded",

                    live:
                        health.live,

                    ready:
                        health.ready,

                    healthy:
                        health.healthy,

                    started:
                        health.started,

                    starting:
                        health.starting,

                    shuttingDown:
                        health.shuttingDown,

                    stopped:
                        health.stopped,

                    failed:
                        health.failed,

                    phase:
                        health.phase,

                    lastHealthCheck:
                        health.lastHealthCheck,

                    timestamp:
                        new Date()
                            .toISOString(),

                    uptime:
                        process.uptime()

                });

        }
    );

}

// =============================================================================
// Internal Diagnostics
// =============================================================================
//
// This endpoint is deliberately development/test focused.
//
// Do not expose internal runtime diagnostics publicly in production without
// authentication/authorization or network-level restriction.
// =============================================================================

function registerDiagnosticRoutes(
    app
) {

    app.get(
        "/health/diagnostics",
        (
            req,
            res
        ) => {

            /*
             * Keep the production surface intentionally hidden.
             *
             * This should later be replaced by an authenticated internal
             * diagnostics endpoint if operational access is required.
             */

            const configuration =
                app.getConfiguration
                    ? app.getConfiguration()
                    : null;

            if (
                configuration?.production
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        code:
                            "NOT_FOUND",

                        message:
                            "Not found."

                    });

            }

            const state =
                getApplicationState();

            const snapshot = {

                success:
                    true,

                timestamp:
                    new Date()
                        .toISOString(),

                state

            };

            return res
                .status(200)
                .json(
                    snapshot
                );

        }
    );

}

// =============================================================================
// Route Not Found
// =============================================================================

function registerNotFoundHandler(
    app
) {

    app.use(
        (
            req,
            res,
            next
        ) => {

            /*
             * Leave actual error formatting to the centralized error handler.
             *
             * If the error middleware runs after this handler, it will receive
             * a normalized 404 error.
             */

            const error =
                new Error(
                    `Route not found: ${req.method} ${req.originalUrl}`
                );

            error.status =
                404;

            error.statusCode =
                404;

            error.code =
                "ROUTE_NOT_FOUND";

            next(
                error
            );

        }
    );

}

// =============================================================================
// Register Routes
// =============================================================================

function registerRoutes(
    app
) {

    if (
        !app ||
        typeof app.use !==
            "function"
    ) {

        throw new Error(
            "Express application instance is required."
        );

    }

    /*
     * API routes.
     */

    registerApiRoutes(
        app
    );

    /*
     * Runtime health routes.
     */

    registerHealthRoutes(
        app
    );

    /*
     * Internal diagnostics.
     */

    registerDiagnosticRoutes(
        app
    );

    /*
     * Route-not-found handler MUST be registered after all normal routes.
     */

    registerNotFoundHandler(
        app
    );

    return app;

}

// =============================================================================
// Exports
// =============================================================================

module.exports = {

    registerRoutes,

    registerApiRoutes,

    registerHealthRoutes,

    registerDiagnosticRoutes,

    registerNotFoundHandler

};