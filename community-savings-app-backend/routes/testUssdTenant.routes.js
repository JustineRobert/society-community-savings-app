"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * File: backend/routes/testUssdTenant.routes.js
 * Enterprise USSD Tenant Middleware Test Routes
 * ============================================================================
 *
 * Purpose
 * ----------------------------------------------------------------------------
 * ✓ Validate ussdTenantMiddleware
 * ✓ Verify Tenant Resolution
 * ✓ Verify Service Code Mapping
 * ✓ Verify Request Context
 * ✓ Verify Correlation IDs
 * ✓ Verify Diagnostics
 * ✓ Verify Feature Flags
 * ✓ Development / QA Testing
 *
 * WARNING
 * ----------------------------------------------------------------------------
 * Disable or protect these routes in production.
 * ============================================================================
 */

const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const ussdTenantMiddleware =
    require("../middleware/ussdTenantMiddleware");

const logger =
    require("../utils/logger");

const metricsService =
    require("../services/metricsService");

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
 * Metrics Middleware
 * ========================================================================== */

function metricsMiddleware(
    req,
    res,
    next
) {

    const started =
        Date.now();

    res.on(
        "finish",

        () => {

            const duration =
                Date.now() - started;

            try {

                metricsService?.increment?.(
                    "titech.test.ussd.requests"
                );

                metricsService?.timing?.(
                    "titech.test.ussd.duration",
                    duration
                );

            } catch (error) {

                logger?.warn?.(
                    "USSD Test Metrics Failed",
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
 * Health Check
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
                "testUssdTenant",

            healthy: true,

            timestamp:
                new Date()
                    .toISOString()
        });
    }
);

/* ============================================================================
 * Middleware Validation Test
 * ========================================================================== */

router.post(

    "/",

    requestContextMiddleware,

    metricsMiddleware,

    ussdTenantMiddleware,

    async (
        req,
        res
    ) => {

        try {

            logger.info(
                "USSD Tenant Test Successful",
                {

                    tenantId:
                        req.tenantId,

                    requestId:
                        req.requestId
                }
            );

            return res.status(200).json({

                success: true,

                message:
                    "USSD Tenant Middleware Passed",

                requestContext: {

                    requestId:
                        req.requestId,

                    correlationId:
                        req.correlationId
                },

                tenant: {

                    id:
                        req.tenant?.id,

                    code:
                        req.tenant?.code,

                    name:
                        req.tenant?.name,

                    status:
                        req.tenant?.status
                },

                tenantContext:
                    req.tenantContext,

                diagnostics:
                    req.ussdDiagnostics ||

                    null
            });

        } catch (error) {

            logger.error(
                "USSD Tenant Test Failed",
                {
                    error:
                        error.message
                }
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message
            });
        }
    }
);

/* ============================================================================
 * Service Code Resolution Test
 * ========================================================================== */

router.post(

    "/service-code",

    requestContextMiddleware,

    metricsMiddleware,

    ussdTenantMiddleware,

    async (
        req,
        res
    ) => {

        return res.status(200).json({

            success: true,

            serviceCode:
                req.body?.serviceCode,

            tenantId:
                req.tenantId,

            tenant:
                req.tenant?.name
        });
    }
);

/* ============================================================================
 * Diagnostics
 * ========================================================================== */

router.get(

    "/diagnostics",

    requestContextMiddleware,

    async (
        req,
        res
    ) => {

        return res.status(200).json({

            service:
                "testUssdTenant",

            version:
                "1.0.0",

            endpoints: [

                "POST /",
                "POST /service-code",
                "GET /health",
                "GET /diagnostics"
            ],

            timestamp:
                new Date()
                    .toISOString()
        });
    }
);

/* ============================================================================
 * Route Auto Loader Contract
 * ========================================================================== */

module.exports = {

    version: "v1",

    path: "/test/ussd-tenant",

    router,

    metadata: {

        name:
            "USSD Tenant Middleware Test",

        description:
            "Validates tenant resolution and request context",

        environment:
            "development"
    }
};