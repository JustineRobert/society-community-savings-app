"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * Enterprise Route Registration
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/routes.js
 *
 * Purpose:
 *   Centralize application route registration.
 *
 * Architecture:
 *
 *   Application
 *       │
 *       ├── /api/auth
 *       │
 *       ├── /api/legal
 *       │
 *       ├── /api/email
 *       │
 *       └── /api/financial
 *              │
 *              ├── Authentication
 *              ├── Tenant Authorization
 *              ├── Financial Idempotency
 *              └── Financial Controller
 *                       │
 *                       ▼
 *                Financial Transaction
 *                       │
 *                       ├── Transaction
 *                       ├── Ledger
 *                       ├── Balance
 *                       └── Idempotency
 *
 * IMPORTANT
 * =============================================================================
 *
 * Financial idempotency MUST NOT be installed globally here.
 *
 * The idempotency middleware is a financial-operation boundary and belongs
 * after authentication + tenant authorization and immediately before the
 * financial controller/service.
 *
 * This prevents unrelated routes such as:
 *
 *   GET /health
 *   POST /api/auth/login
 *   POST /api/email/...
 *
 * from participating in financial idempotency semantics.
 *
 * =============================================================================
 */

// =============================================================================
// Route Registration
// =============================================================================

function registerRoutes(app) {

    if (!app || typeof app.use !== "function") {

        throw new TypeError(
            "Express application instance is required."
        );
    }

    // =========================================================================
    // Public / Platform Routes
    // =========================================================================

    registerAuthRoutes(app);

    registerLegalRoutes(app);

    registerEmailRoutes(app);

    // =========================================================================
    // Financial Routes
    // =========================================================================
    //
    // Financial routes are intentionally registered separately from the
    // platform/public routes.
    //
    // The financial route module itself is responsible for composing:
    //
    //   authentication
    //        ↓
    //   tenant authorization
    //        ↓
    //   idempotency
    //        ↓
    //   financial controller
    //
    // This keeps the bootstrap layer independent from individual financial
    // products such as:
    //
    //   savings
    //   contributions
    //   deposits
    //   withdrawals
    //   transfers
    //   loans
    //   wallet
    //   mobile money
    //
    registerFinancialRoutes(app);

    // =========================================================================
    // Operational Routes
    // =========================================================================

    registerHealthRoutes(app);

    registerReadinessRoute(app);

    registerLivenessRoute(app);

    return app;
}

// =============================================================================
// Authentication
// =============================================================================

function registerAuthRoutes(app) {

    const authRoutes =
        require("../routes/auth");

    app.use(
        "/api/auth",
        authRoutes
    );
}

// =============================================================================
// Legal
// =============================================================================

function registerLegalRoutes(app) {

    const legalRoutes =
        require("../routes/legal.routes");

    app.use(
        "/api/legal",
        legalRoutes
    );
}

// =============================================================================
// Email
// =============================================================================

function registerEmailRoutes(app) {

    const emailRoutes =
        require("../routes/email");

    app.use(
        "/api/email",
        emailRoutes
    );
}

// =============================================================================
// Financial
// =============================================================================
//
// The financial router should own the security chain:
//
//   authentication
//       ↓
//   tenant authorization
//       ↓
//   idempotency
//       ↓
//   financial controller
//
// Do NOT place the idempotency middleware globally in app.js or here at the
// application level.
//
// =============================================================================

function registerFinancialRoutes(app) {

    /*
     * The financial route module becomes the single entry point for
     * balance-affecting operations.
     *
     * Expected future structure:
     *
     *   backend/routes/financial.routes.js
     *
     * with route-level composition such as:
     *
     *   router.post(
     *       "/transactions",
     *       authenticate,
     *       tenantAuthorization,
     *       idempotency({
     *           operation: "FINANCIAL_TRANSACTION",
     *           resource: "transactions"
     *       }),
     *       controller
     *   );
     *
     * This module is intentionally required here rather than embedding
     * middleware logic in bootstrap/routes.js.
     */

    const financialRoutes =
        require("../routes/financial.routes");

    app.use(
        "/api/financial",
        financialRoutes
    );
}

// =============================================================================
// Health
// =============================================================================

function registerHealthRoutes(app) {

    app.get(
        "/health",
        (req, res) => {

            const state =
                typeof app.getApplicationState === "function"
                    ? app.getApplicationState()
                    : null;

            const healthy =
                Boolean(
                    state?.healthy
                );

            res.status(
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
                        : "starting",

                timestamp:
                    new Date().toISOString(),

                uptime:
                    process.uptime(),

                bootstrapPhase:
                    state?.bootstrapPhase ||
                    "unknown"

            });
        }
    );
}

// =============================================================================
// Readiness
// =============================================================================

function registerReadinessRoute(app) {

    app.get(
        "/ready",
        (req, res) => {

            const state =
                typeof app.getApplicationState === "function"
                    ? app.getApplicationState()
                    : null;

            const ready =
                Boolean(
                    state?.healthy &&
                    !state?.shuttingDown
                );

            if (ready) {

                return res
                    .status(200)
                    .json({

                        ready:
                            true

                    });
            }

            return res
                .status(503)
                .json({

                    ready:
                        false,

                    state:
                        state || {
                            healthy:
                                false,

                            shuttingDown:
                                false
                        }

                });
        }
    );
}

// =============================================================================
// Liveness
// =============================================================================

function registerLivenessRoute(app) {

    app.get(
        "/live",
        (req, res) => {

            res
                .status(200)
                .json({

                    alive:
                        true,

                    timestamp:
                        new Date().toISOString()

                });
        }
    );
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {

    registerRoutes,

    registerAuthRoutes,

    registerLegalRoutes,

    registerEmailRoutes,

    registerFinancialRoutes,

    registerHealthRoutes,

    registerReadinessRoute,

    registerLivenessRoute

};