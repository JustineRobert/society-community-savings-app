"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * File: backend/routes/savings.routes.js
 * Enterprise Savings Routes
 * ============================================================================
 */

const express = require("express");

const router = express.Router();

const savingsController =
    require("../controllers/savingsController");

const tenantMiddleware =
    require("../middleware/tenantMiddleware");

const logger =
    require("../utils/logger");

const metricsService =
    require("../services/metricsService");

/* ============================================================================
 * Route Metrics Middleware
 * ========================================================================== */

function routeMetricsMiddleware(
    req,
    res,
    next
) {

    const startedAt =
        Date.now();

    res.on(
        "finish",

        () => {

            try {

                metricsService.increment(
                    "titech.savings.route.requests"
                );

                metricsService.timing(
                    "titech.savings.route.duration",

                    Date.now() - startedAt
                );

            } catch (error) {

                logger.warn(
                    "Savings Metrics Failed",
                    {
                        error:
                            error.message
                    }
                );
            }
        }
    );

    next();
}

/* ============================================================================
 * Enterprise Middleware
 * ========================================================================== */

router.use(
    tenantMiddleware
);

router.use(
    routeMetricsMiddleware
);

/* ============================================================================
 * Health
 * ========================================================================== */

router.get(
    "/health",

    async (
        req,
        res
    ) => {

        return res.status(200).json({

            success: true,

            service:
                "savings",

            status:
                "healthy",

            timestamp:
                new Date()
                    .toISOString()
        });
    }
);

/* ============================================================================
 * Diagnostics
 * ========================================================================== */

router.get(
    "/diagnostics",

    async (
        req,
        res
    ) => {

        const diagnostics =

            typeof savingsController
                .getDiagnostics ===
            "function"

                ? savingsController
                    .getDiagnostics()

                : {};

        return res.status(200).json({

            success: true,

            diagnostics
        });
    }
);

/* ============================================================================
 * Account Management
 * ========================================================================== */

router.post(
    "/",

    savingsController
        .createSavingsAccount
        .bind(
            savingsController
        )
);

router.get(
    "/accounts",

    savingsController
        .listAccounts
        .bind(
            savingsController
        )
);

router.get(
    "/:accountId",

    savingsController
        .getSavingsAccount
        .bind(
            savingsController
        )
);

/* ============================================================================
 * Transactions
 * ========================================================================== */

router.post(
    "/deposit",

    savingsController
        .deposit
        .bind(
            savingsController
        )
);

router.post(
    "/withdraw",

    savingsController
        .withdraw
        .bind(
            savingsController
        )
);

/* ============================================================================
 * Balance & Statements
 * ========================================================================== */

router.get(
    "/member/:memberId/balance",

    savingsController
        .getBalance
        .bind(
            savingsController
        )
);

router.get(
    "/member/:memberId/mini-statement",

    savingsController
        .miniStatement
        .bind(
            savingsController
        )
);

router.get(
    "/member/:memberId/statement",

    savingsController
        .statement
        .bind(
            savingsController
        )
);

router.get(
    "/member/:memberId/summary",

    savingsController
        .summary
        .bind(
            savingsController
        )
);

/* ============================================================================
 * Interest
 * ========================================================================== */

router.get(
    "/:accountId/interest",

    savingsController
        .calculateInterest
        .bind(
            savingsController
        )
);

/* ============================================================================
 * Lifecycle Management
 * ========================================================================== */

router.post(
    "/:accountId/activate",

    savingsController
        .activateAccount
        .bind(
            savingsController
        )
);

router.post(
    "/:accountId/close",

    savingsController
        .closeAccount
        .bind(
            savingsController
        )
);

/* ============================================================================
 * Administrative Reporting
 * ========================================================================== */

router.get(
    "/reports/portfolio",

    savingsController
        .portfolioReport
        .bind(
            savingsController
        )
);

/* ============================================================================
 * Route Error Handler
 * ========================================================================== */

router.use(
    (
        error,
        req,
        res,
        next
    ) => {

        logger.error(
            "Savings Route Error",
            {
                tenantId:
                    req.tenantId,

                userId:
                    req.userId,

                requestId:
                    req.requestId,

                correlationId:
                    req.correlationId,

                error:
                    error.message
            }
        );

        return res.status(500).json({

            success: false,

            code:
                "SAVINGS_ROUTE_ERROR",

            message:
                "An error occurred while processing the request."
        });
    }
);

/* ============================================================================
 * Route Auto Loader Contract
 * ========================================================================== */

module.exports = {

    version: "v1",

    path: "/savings",

    router,

    metadata: {

        name:
            "Enterprise Savings Service",

        category:
            "savings",

        supports: [

            "savings_accounts",
            "deposits",
            "withdrawals",
            "statements",
            "interest",
            "portfolio_reporting"
        ]
    }
};