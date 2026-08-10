
// ============================================================================
// TITech Community Capital LTD
// Finance Routes
// File: backend/modules/finance/routes.js
// ============================================================================
//
// Enterprise-grade finance HTTP routes.
//
// Responsibilities:
//   - Authentication and tenant isolation
//   - Request validation and sanitization
//   - Idempotency enforcement
//   - Rate limiting
//   - Request correlation propagation
//   - Delegation to finance application services
//   - Stable HTTP response contracts
//
// Architectural rule:
//   Routes MUST remain thin.
//   Financial business logic belongs in application/domain services.
//
// Processing:
//
//   HTTP Request
//       |
//       v
//   Authentication
//       |
//       v
//   Tenant Resolution
//       |
//       v
//   Rate Limiting
//       |
//       v
//   Idempotency
//       |
//       v
//   Validation
//       |
//       v
//   Repayment Service
//       |
//       v
//   Ledger / Transaction Boundary
//       |
//       v
//   HTTP Response
//
// ============================================================================

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const asyncHandler = require('../../../utils/asyncHandler');

const {
    requireAuth
} = require('../../../middleware/auth');

const {
    requireTenant
} = require('../../../middleware/tenant');

const {
    processRepayment
} = require('./services/repaymentService');

const router = express.Router();

/**
 * ============================================================================
 * Constants
 * ============================================================================
 */

const DEFAULT_CURRENCY = 'UGX';

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

const MAX_DESCRIPTION_LENGTH = 1024;

const MAX_METADATA_KEYS = 100;

const REPAYMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const REPAYMENT_RATE_LIMIT_MAX = 10;

/**
 * ============================================================================
 * HTTP Error Helpers
 * ============================================================================
 *
 * Routes should expose safe client-facing errors and never leak database,
 * stack-trace, provider, or infrastructure details.
 * ============================================================================
 */

function sendClientError(
    res,
    status,
    error,
    details = undefined
) {

    const response = {
        success: false,
        error
    };

    if (details !== undefined) {
        response.details = details;
    }

    return res.status(status).json(response);
}

/**
 * ============================================================================
 * Request Correlation
 * ============================================================================
 *
 * Prefer the existing request ID supplied by upstream middleware.
 * Fall back to X-Request-Id when available.
 *
 * The application/service layer should generate an ID if none exists.
 * ============================================================================
 */

function resolveRequestId(req) {

    return (
        req.id ||
        req.requestId ||
        req.headers['x-request-id'] ||
        null
    );
}

/**
 * ============================================================================
 * Rate Limiter
 * ============================================================================
 *
 * Protects the repayment endpoint against:
 *
 *   - brute-force attempts
 *   - accidental retry storms
 *   - abusive clients
 *   - high-frequency replay attempts
 *
 * The application's global rate limiter should still remain responsible
 * for broader API protection.
 * ============================================================================
 */

const repayLimiter = rateLimit({

    windowMs:
        REPAYMENT_RATE_LIMIT_WINDOW_MS,

    max:
        REPAYMENT_RATE_LIMIT_MAX,

    standardHeaders:
        true,

    legacyHeaders:
        false,

    skipSuccessfulRequests:
        false,

    handler(req, res) {

        return sendClientError(

            res,

            429,

            'Too many repayment requests. Please try again later.'

        );

    }

});

/**
 * ============================================================================
 * Joi Validation Schema
 * ============================================================================
 *
 * stripUnknown prevents arbitrary request fields from entering the
 * application service.
 *
 * The idempotency key is deliberately NOT accepted from the body as a
 * substitute for the HTTP Idempotency-Key header.
 * ============================================================================
 */

const repaySchema = Joi.object({

    loanId:
        Joi.string()
            .trim()
            .min(1)
            .max(128)
            .required(),

    walletId:
        Joi.string()
            .trim()
            .min(1)
            .max(128)
            .required(),

    amount:
        Joi.number()
            .positive()
            .precision(2)
            .unsafe(false)
            .required(),

    currency:
        Joi.string()
            .trim()
            .length(3)
            .uppercase()
            .default(DEFAULT_CURRENCY),

    debitAccountCode:
        Joi.string()
            .trim()
            .max(128)
            .optional(),

    creditAccountCode:
        Joi.string()
            .trim()
            .max(128)
            .optional(),

    description:
        Joi.string()
            .trim()
            .max(MAX_DESCRIPTION_LENGTH)
            .allow('')
            .optional(),

    provider:
        Joi.string()
            .trim()
            .max(128)
            .optional(),

    momoTransactionId:
        Joi.string()
            .trim()
            .max(255)
            .optional(),

    metadata:
        Joi.object()
            .max(MAX_METADATA_KEYS)
            .default({})

}).required();

/**
 * ============================================================================
 * Require Idempotency Key
 * ============================================================================
 *
 * Financial mutation endpoints MUST have a caller-supplied idempotency key.
 *
 * Contract:
 *
 *   Idempotency-Key: <unique-client-key>
 *
 * The key is normalized into req.idempotencyKey for downstream services.
 *
 * IMPORTANT:
 * The body paymentId is not silently promoted to an idempotency key.
 * Payment identity and request idempotency identity are different concepts.
 * ============================================================================
 */

function requireIdempotencyKey(req, res, next) {

    const rawKey =
        req.headers['idempotency-key'];

    const idempotencyKey =
        Array.isArray(rawKey)
            ? rawKey[0]
            : rawKey;

    const normalizedKey =
        idempotencyKey
            ? String(idempotencyKey).trim()
            : '';

    if (!normalizedKey) {

        return sendClientError(

            res,

            400,

            'Idempotency-Key header is required.'

        );

    }

    if (
        normalizedKey.length >
        MAX_IDEMPOTENCY_KEY_LENGTH
    ) {

        return sendClientError(

            res,

            400,

            'Idempotency-Key exceeds the maximum allowed length.'

        );

    }

    req.idempotencyKey =
        normalizedKey;

    return next();

}

/**
 * ============================================================================
 * Validate Repayment Body
 * ============================================================================
 */

function validateRepayBody(req, res, next) {

    const {

        error,

        value

    } = repaySchema.validate(

        req.body,

        {

            abortEarly: false,

            stripUnknown: true,

            convert: true

        }

    );

    if (error) {

        const validationErrors =
            error.details.map(
                detail => ({
                    field:
                        detail.path.join('.'),

                    message:
                        detail.message
                })
            );

        return sendClientError(

            res,

            400,

            'Invalid repayment request.',

            validationErrors

        );

    }

    req.validatedBody =
        value;

    return next();

}

/**
 * ============================================================================
 * Validate Request Context
 * ============================================================================
 *
 * requireAuth and requireTenant should normally guarantee these values.
 * This defensive boundary prevents malformed middleware composition from
 * reaching the financial service.
 * ============================================================================
 */

function validateFinanceContext(req, res, next) {

    if (
        !req.user ||
        !req.user.id
    ) {

        return sendClientError(

            res,

            401,

            'Authentication required.'

        );

    }

    if (
        !req.tenant ||
        !req.tenant.id
    ) {

        return sendClientError(

            res,

            403,

            'Tenant context required.'

        );

    }

    return next();

}

/**
 * ============================================================================
 * POST /repay
 * ============================================================================
 *
 * Process a loan repayment.
 *
 * Financial mutation endpoint.
 *
 * Required:
 *
 *   Authorization: Bearer <token>
 *   Idempotency-Key: <unique-key>
 *
 * Tenant context is established by requireTenant.
 * ============================================================================
 *
 * @openapi
 * /api/finance/repay:
 *   post:
 *     summary: Process a loan repayment
 *     description: >
 *       Processes a tenant-scoped loan repayment through the finance
 *       application service. The operation is idempotent and requires an
 *       Idempotency-Key header.
 *     tags:
 *       - Finance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Unique key used to safely retry the repayment request.
 *       - in: header
 *         name: X-Request-Id
 *         required: false
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Request correlation identifier.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanId
 *               - walletId
 *               - amount
 *             properties:
 *               loanId:
 *                 type: string
 *               walletId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *               currency:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *                 example: UGX
 *               debitAccountCode:
 *                 type: string
 *               creditAccountCode:
 *                 type: string
 *               description:
 *                 type: string
 *                 maxLength: 1024
 *               provider:
 *                 type: string
 *               momoTransactionId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Repayment processed successfully.
 *       '400':
 *         description: Invalid request or missing idempotency key.
 *       '401':
 *         description: Authentication required.
 *       '403':
 *         description: Tenant context required.
 *       '402':
 *         description: Payment or account funding failure.
 *       '409':
 *         description: Idempotency or financial conflict.
 *       '429':
 *         description: Too many repayment requests.
 *       '500':
 *         description: Internal server error.
 */

router.post(

    '/repay',

    requireAuth,

    requireTenant,

    validateFinanceContext,

    repayLimiter,

    requireIdempotencyKey,

    validateRepayBody,

    asyncHandler(

        async (req, res) => {

            const body =
                req.validatedBody;

            const tenantId =
                req.tenant.id;

            const userId =
                req.user.id;

            const requestId =
                resolveRequestId(req);

            const idempotencyKey =
                req.idempotencyKey;

            const opts = {

                currency:
                    body.currency ||
                    DEFAULT_CURRENCY,

                debitAccountCode:
                    body.debitAccountCode ||
                    null,

                creditAccountCode:
                    body.creditAccountCode ||
                    null,

                description:
                    body.description ||
                    null,

                requestId,

                idempotencyKey,

                provider:
                    body.provider ||
                    null,

                momoTransactionId:
                    body.momoTransactionId ||
                    null,

                metadata:
                    body.metadata || {},

                createdBy:
                    userId

            };

            const result =
                await processRepayment({

                    tenantId,

                    loanId:
                        body.loanId,

                    payerWalletId:
                        body.walletId,

                    amount:
                        body.amount,

                    paymentId:
                        idempotencyKey,

                    opts

                });

            return res.status(200).json({

                success:
                    true,

                result,

                requestId,

                idempotencyKey

            });

        }

    )

);

/**
 * ============================================================================
 * Export
 * ============================================================================
 */

module.exports = router;