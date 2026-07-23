"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * File: backend/routes/ussd.routes.js
 * Enterprise USSD Gateway Routes
 * ============================================================================
 *
 * Responsibilities
 * ----------------------------------------------------------------------------
 * ✓ USSD Entry Point
 * ✓ Health Check
 * ✓ Diagnostics
 * ✓ Request Correlation
 * ✓ Tenant Enforcement
 * ✓ Error Handling
 * ✓ Metrics Collection
 * ✓ Gateway Compatibility
 *
 * Supported Providers
 * ----------------------------------------------------------------------------
 * ✓ Africa's Talking
 * ✓ MTN MoMo USSD
 * ✓ Airtel Money USSD
 * ✓ Future Aggregators
 * ============================================================================
 */

const express = require("express");

const router = express.Router();

const crypto = require("crypto");

const ussdController =
    require("../controllers/ussdController");

const logger =
    require("../utils/logger");

const tenantMiddleware =
    require("../middleware/tenantMiddleware");

const metricsService =
    require("../services/metricsService");

const ussdTenantMiddleware =
    require(
        "../middleware/ussdTenantMiddleware"
    );
/* ============================================================================
 * Constants
 * ========================================================================== */

const ROUTE_NAME =
    "USSD_GATEWAY";

/* ============================================================================
 * Request Context Middleware
 * ========================================================================== */

function requestContextMiddleware(
    req,
    res,
    next
) {

    req.requestId =

        req.requestId ||

        req.headers["x-request-id"] ||

        crypto.randomUUID();

    req.correlationId =

        req.correlationId ||

        req.headers["x-correlation-id"] ||

        crypto.randomUUID();

    res.setHeader(
        "X-Request-ID",
        req.requestId
    );

    res.setHeader(
        "X-Correlation-ID",
        req.correlationId
    );

    next();
}

/* ============================================================================
 * USSD Payload Validation
 * ========================================================================== */

function validateUSSDPayload(
    req,
    res,
    next
) {

    const {

        sessionId,

        serviceCode,

        phoneNumber

    } = req.body || {};

    if (!sessionId) {

        return res.status(400)
            .type("text/plain")
            .send(
                "END Invalid session."
            );
    }

    if (!phoneNumber) {

        return res.status(400)
            .type("text/plain")
            .send(
                "END Invalid phone number."
            );
    }

    if (!serviceCode) {

        logger.warn(
            "USSD service code missing",
            {
                requestId:
                    req.requestId
            }
        );
    }

    return next();
}

/* ============================================================================
 * Route Metrics
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

            const duration =

                Date.now() -
                startedAt;

            try {

                metricsService.increment(
                    "titech.ussd.route.requests"
                );

                metricsService.timing(
                    "titech.ussd.route.duration",
                    duration
                );

            } catch (error) {

                logger.warn(
                    "USSD Metrics Failed",
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
 * Health Endpoint
 * ========================================================================== */

router.get(
    "/health",

    async (
        req,
        res
    ) => {

        return res.status(200).json({

            healthy: true,

            route:
                ROUTE_NAME,

            timestamp:
                new Date()
                    .toISOString()
        });
    }
);

/* ============================================================================
 * Diagnostics Endpoint
 * ========================================================================== */

router.get(
    "/diagnostics",

    async (
        req,
        res
    ) => {

        try {

            return res.status(200).json({

                route:
                    ROUTE_NAME,

                controller:

                    typeof ussdController
                        .getDiagnostics === "function"

                        ? ussdController.getDiagnostics()

                        : null,

                timestamp:
                    new Date()
                        .toISOString()
            });

        } catch (error) {

            return res.status(500).json({

                success: false,

                message:
                    error.message
            });
        }
    }
);

/* ============================================================================
 * Apply Enterprise Middleware
 * ========================================================================== */

router.use(
    requestContextMiddleware
);

router.use(
    routeMetricsMiddleware
);

router.post(

    "/",

    requestContextMiddleware,

    routeMetricsMiddleware,

    validateUSSDPayload,

    ussdTenantMiddleware,

    async (
        req,
        res,
        next
    ) => {

        try {

            logger.info(
                "USSD Request Received",
                {

                    tenantId:
                        req.tenantId,

                    requestId:
                        req.requestId,

                    correlationId:
                        req.correlationId,

                    sessionId:
                        req.body?.sessionId,

                    phoneNumber:
                        req.body?.phoneNumber,

                    serviceCode:
                        req.body?.serviceCode
                }
            );

            const response =

                await ussdController.handle(
                    req,
                    res
                );

            return res
                .status(200)
                .type("text/plain")
                .send(response);

        } catch (error) {

            logger.error(
                "USSD Processing Failed",
                {

                    tenantId:
                        req.tenantId,

                    requestId:
                        req.requestId,

                    error:
                        error.message
                }
            );

            return next(error);
        }
    }
);

/* ============================================================================
 * USSD Gateway Endpoint
 * ========================================================================== */

router.post(
    "/",

    validateUSSDPayload,

    async (
        req,
        res,
        next
    ) => {

        try {

            logger.info(
                "USSD Request Received",
                {
                    requestId:
                        req.requestId,

                    correlationId:
                        req.correlationId,

                    sessionId:
                        req.body
                            ?.sessionId,

                    phoneNumber:
                        req.body
                            ?.phoneNumber
                }
            );

            const response =

                await ussdController.handle(
                    req,
                    res
                );

            return res
                .status(200)
                .type("text/plain")
                .send(response);

        } catch (error) {

            logger.error(
                "USSD Route Error",
                {
                    requestId:
                        req.requestId,

                    error:
                        error.message
                }
            );

            return next(error);
        }
    }
);

/* ============================================================================
 * Enterprise Error Handler
 * ========================================================================== */

router.use(
    (
        error,
        req,
        res,
        next
    ) => {

        logger.error(
            "USSD Route Failure",
            {
                error:
                    error.message,

                requestId:
                    req.requestId
            }
        );

        return res
            .status(500)
            .type("text/plain")
            .send(
                "END Service temporarily unavailable."
            );
    }
);

/* ============================================================================
 * Route Auto Loader Contract
 * ========================================================================== */

module.exports = {

    version: "v1",

    path: "/ussd",

    router,

    metadata: {

        name:
            "TITech USSD Gateway",

        route:
            "/api/v1/ussd",

        supports: [

            "AfricaTalking",

            "MTN",

            "Airtel"
        ]
    }
};