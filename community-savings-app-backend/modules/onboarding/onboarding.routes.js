"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Routes
 * ============================================================================
 *
 * File:
 * backend/modules/onboarding/onboarding.routes.js
 *
 * Purpose:
 * ----------------------------------------------------------------------------
 * Secure HTTP boundary for SACCO onboarding lifecycle operations.
 *
 * Responsibilities:
 * ----------------------------------------------------------------------------
 * - Authentication
 * - Tenant resolution / isolation
 * - RBAC authorization
 * - Request validation
 * - Rate limiting
 * - Idempotency hooks
 * - File upload protection
 * - Audit hooks
 * - Controller delegation
 *
 * Architecture:
 * ----------------------------------------------------------------------------
 *
 * Request
 *   │
 *   ▼
 * Authentication
 *   │
 *   ▼
 * Tenant Resolution
 *   │
 *   ▼
 * Request Security
 *   │
 *   ▼
 * RBAC
 *   │
 *   ▼
 * Validation
 *   │
 *   ▼
 * Idempotency / Audit
 *   │
 *   ▼
 * Controller
 *   │
 *   ▼
 * Onboarding Service
 *
 * IMPORTANT:
 * ----------------------------------------------------------------------------
 * Business lifecycle rules MUST remain in onboarding.service.js.
 *
 * Routes should NOT:
 * - modify database records directly
 * - implement KYC rules
 * - implement subscription rules
 * - decide whether a SACCO can go live
 * - perform financial postings
 * - configure payment providers directly
 *
 * ============================================================================
 */

const express = require("express");

const router = express.Router();

/**
 * ============================================================================
 * CONTROLLER
 * ============================================================================
 */

const controller = require("./onboarding.controller");

/**
 * ============================================================================
 * VALIDATIONS
 * ============================================================================
 */

const {
  validateSacco,
  validateKYC,
  validateSubscription,
  validateRejection,
} = require("./onboarding.validation");

/**
 * ============================================================================
 * SECURITY
 * ============================================================================
 */

const authenticate = require("../../middleware/auth.middleware");

const authorize = require("../../middleware/rbac.middleware");

const tenantMiddleware = require("../../tenancy/tenant.middleware");

/**
 * ============================================================================
 * FILE UPLOADS
 * ============================================================================
 */

const upload = require("../../middleware/upload.middleware");

/**
 * ============================================================================
 * RATE LIMITING
 * ============================================================================
 */

const rateLimiter = require("../../security/rateLimiting");

/**
 * ============================================================================
 * OPTIONAL ENTERPRISE MIDDLEWARE
 * ============================================================================
 *
 * These are loaded defensively so the onboarding route does not become
 * dependent on optional infrastructure that may not yet be installed.
 *
 * Once the corresponding enterprise middleware exists, it will automatically
 * be used.
 * ============================================================================
 */

let validateObjectId = null;
let idempotencyMiddleware = null;
let auditMiddleware = null;

/**
 * --------------------------------------------------------------------------
 * ObjectId validation
 * --------------------------------------------------------------------------
 */

try {
  validateObjectId = require("../../middleware/validateObjectId");
} catch (error) {
  validateObjectId = null;
}

/**
 * --------------------------------------------------------------------------
 * Idempotency
 * --------------------------------------------------------------------------
 */

try {
  idempotencyMiddleware = require("../../middleware/idempotency.middleware");
} catch (error) {
  idempotencyMiddleware = null;
}

/**
 * --------------------------------------------------------------------------
 * Audit
 * --------------------------------------------------------------------------
 */

try {
  auditMiddleware = require("../../middleware/auditLogMiddleware");
} catch (error) {
  auditMiddleware = null;
}

/**
 * ============================================================================
 * FALLBACK HELPERS
 * ============================================================================
 */

/**
 * No-op middleware.
 *
 * This keeps the route module operational if an optional enterprise
 * middleware has not yet been introduced.
 */
const noop = (req, res, next) => next();

/**
 * ObjectId middleware factory.
 *
 * Supports projects where validateObjectId exports:
 *
 *   validateObjectId("id")
 *
 * or:
 *
 *   validateObjectId
 *
 * without forcing the rest of the application to change.
 */
function objectIdParam(param = "id") {
  if (!validateObjectId) {
    return noop;
  }

  if (typeof validateObjectId === "function") {
    try {
      const middleware = validateObjectId(param);

      if (typeof middleware === "function") {
        return middleware;
      }
    } catch (error) {
      /**
       * Some implementations export the middleware directly.
       */
      return validateObjectId;
    }
  }

  return noop;
}

/**
 * ============================================================================
 * IDEMPOTENCY HELPERS
 * ============================================================================
 */

function idempotent(options = {}) {
  if (!idempotencyMiddleware) {
    return noop;
  }

  if (typeof idempotencyMiddleware === "function") {
    try {
      const middleware =
        idempotencyMiddleware(options);

      if (typeof middleware === "function") {
        return middleware;
      }
    } catch (error) {
      return idempotencyMiddleware;
    }
  }

  return noop;
}

/**
 * ============================================================================
 * AUDIT HELPERS
 * ============================================================================
 */

function audit(action) {
  if (!auditMiddleware) {
    return noop;
  }

  if (typeof auditMiddleware === "function") {
    try {
      const middleware = auditMiddleware(action);

      if (typeof middleware === "function") {
        return middleware;
      }
    } catch (error) {
      return auditMiddleware;
    }
  }

  return noop;
}

/**
 * ============================================================================
 * GLOBAL ROUTE SECURITY
 * ============================================================================
 *
 * Authentication MUST happen before tenant resolution.
 *
 * The tenant middleware can therefore use the authenticated principal to
 * resolve the correct tenant context.
 * ============================================================================
 */

router.use(authenticate);

router.use(tenantMiddleware);

/**
 * ============================================================================
 * CREATE SACCO
 * ============================================================================
 *
 * POST /api/v1/onboarding/saccos
 *
 * Security:
 * - Authentication
 * - Tenant isolation
 * - Rate limiting
 * - RBAC
 * - Validation
 * - Idempotency
 * - Audit
 * ============================================================================
 */

router.post(
  "/saccos",

  rateLimiter,

  authorize("SACCO_CREATE"),

  validateSacco,

  idempotent({
    operation: "SACCO_CREATE",
    required: false,
  }),

  audit("SACCO_CREATE"),

  controller.registerSacco
);

/**
 * ============================================================================
 * GET ALL SACCOS
 * ============================================================================
 *
 * GET /api/v1/onboarding/saccos
 *
 * Query examples:
 *
 * ?status=LIVE
 * ?status=KYC_PENDING
 * ?page=1&limit=20
 *
 * Tenant filtering MUST ultimately be enforced by the service/repository.
 * ============================================================================
 */

router.get(
  "/saccos",

  authorize("SACCO_VIEW"),

  controller.getAllSaccos
);

/**
 * ============================================================================
 * GET ONBOARDING METRICS
 * ============================================================================
 *
 * IMPORTANT:
 * --------------------------------------------------------------------------
 * This route intentionally appears before /saccos/:id routes.
 *
 * GET /api/v1/onboarding/metrics
 * ============================================================================
 */

router.get(
  "/metrics",

  authorize("SACCO_ANALYTICS"),

  controller.getOnboardingMetrics
);

/**
 * ============================================================================
 * GET SACCO BY ID
 * ============================================================================
 *
 * GET /api/v1/onboarding/saccos/:id
 * ============================================================================
 */

router.get(
  "/saccos/:id",

  objectIdParam("id"),

  authorize("SACCO_VIEW"),

  controller.getSaccoById
);

/**
 * ============================================================================
 * GET ONBOARDING PROGRESS
 * ============================================================================
 *
 * GET /api/v1/onboarding/saccos/:id/progress
 * ============================================================================
 */

router.get(
  "/saccos/:id/progress",

  objectIdParam("id"),

  authorize("SACCO_VIEW"),

  controller.getOnboardingProgress
);

/**
 * ============================================================================
 * VERIFY / APPROVE KYC
 * ============================================================================
 *
 * PUT /api/v1/onboarding/saccos/:id/kyc
 *
 * This operation is idempotent at the service level.
 * ============================================================================
 */

router.put(
  "/saccos/:id/kyc",

  objectIdParam("id"),

  authorize("SACCO_KYC_APPROVE"),

  validateKYC,

  idempotent({
    operation: "SACCO_KYC_APPROVAL",
    required: true,
  }),

  audit("SACCO_KYC_APPROVAL"),

  controller.verifyKYC
);

/**
 * ============================================================================
 * UPLOAD KYC DOCUMENTS
 * ============================================================================
 *
 * POST /api/v1/onboarding/saccos/:id/documents
 *
 * File upload security should also be enforced by upload.middleware.
 *
 * Recommended production controls:
 * - Maximum 20 files
 * - Maximum file size
 * - MIME allowlist
 * - Extension allowlist
 * - Malware scanning
 * - Content validation
 * - Secure object storage
 * - SHA-256 checksum
 * ============================================================================
 */

router.post(
  "/saccos/:id/documents",

  objectIdParam("id"),

  authorize("SACCO_KYC_UPLOAD"),

  upload.array("documents", 20),

  idempotent({
    operation: "SACCO_DOCUMENT_UPLOAD",
    required: false,
  }),

  audit("SACCO_DOCUMENT_UPLOAD"),

  controller.uploadDocuments
);

/**
 * ============================================================================
 * VERIFY KYC DOCUMENT
 * ============================================================================
 *
 * POST /api/v1/onboarding/saccos/:id/documents/:documentId/verify
 *
 * Recommended controller/service operation:
 *
 * verifyDocument(saccoId, documentId, actor)
 *
 * ============================================================================
 */

router.post(
  "/saccos/:id/documents/:documentId/verify",

  objectIdParam("id"),

  authorize("SACCO_KYC_APPROVE"),

  idempotent({
    operation: "SACCO_DOCUMENT_VERIFY",
    required: true,
  }),

  audit("SACCO_DOCUMENT_VERIFY"),

  controller.verifyDocument ||
    ((req, res) =>
      res.status(501).json({
        success: false,
        message:
          "KYC document verification not implemented",
      }))
);

/**
 * ============================================================================
 * SETUP SUBSCRIPTION
 * ============================================================================
 *
 * PUT /api/v1/onboarding/saccos/:id/subscription
 * ============================================================================
 */

router.put(
  "/saccos/:id/subscription",

  objectIdParam("id"),

  authorize("SACCO_SUBSCRIPTION"),

  validateSubscription,

  idempotent({
    operation: "SACCO_SUBSCRIPTION_SETUP",
    required: true,
  }),

  audit("SACCO_SUBSCRIPTION_SETUP"),

  controller.setupSubscription
);

/**
 * ============================================================================
 * GO LIVE
 * ============================================================================
 *
 * PUT /api/v1/onboarding/saccos/:id/live
 *
 * This MUST NOT simply set status = LIVE.
 *
 * The service should verify:
 *
 * - Registration complete
 * - KYC approved
 * - Compliance approved
 * - Subscription active
 * - Tenant configured
 * - Admin provisioned
 * - Required modules configured
 * - Mobile money readiness where applicable
 * - Training complete
 * - Go-live approval
 * ============================================================================
 */

router.put(
  "/saccos/:id/live",

  objectIdParam("id"),

  authorize("SACCO_GO_LIVE"),

  idempotent({
    operation: "SACCO_GO_LIVE",
    required: true,
  }),

  audit("SACCO_GO_LIVE"),

  controller.goLive
);

/**
 * ============================================================================
 * REJECT APPLICATION
 * ============================================================================
 *
 * PUT /api/v1/onboarding/saccos/:id/reject
 * ============================================================================
 */

router.put(
  "/saccos/:id/reject",

  objectIdParam("id"),

  authorize("SACCO_REJECT"),

  validateRejection,

  idempotent({
    operation: "SACCO_REJECTION",
    required: true,
  }),

  audit("SACCO_REJECTION"),

  controller.rejectApplication
);

/**
 * ============================================================================
 * SUSPEND SACCO
 * ============================================================================
 *
 * PUT /api/v1/onboarding/saccos/:id/suspend
 * ============================================================================
 */

router.put(
  "/saccos/:id/suspend",

  objectIdParam("id"),

  authorize("SACCO_SUSPEND"),

  idempotent({
    operation: "SACCO_SUSPEND",
    required: true,
  }),

  audit("SACCO_SUSPEND"),

  controller.suspend ||
    ((req, res) =>
      res.status(501).json({
        success: false,
        message:
          "SACCO suspension not implemented",
      }))
);

/**
 * ============================================================================
 * RESTORE SUSPENDED SACCO
 * ============================================================================
 *
 * PUT /api/v1/onboarding/saccos/:id/restore
 * ============================================================================
 */

router.put(
  "/saccos/:id/restore",

  objectIdParam("id"),

  authorize("SACCO_RESTORE"),

  idempotent({
    operation: "SACCO_RESTORE",
    required: true,
  }),

  audit("SACCO_RESTORE"),

  controller.restore ||
    ((req, res) =>
      res.status(501).json({
        success: false,
        message:
          "SACCO restoration not implemented",
      }))
);

/**
 * ============================================================================
 * MTN MOMO SETUP
 * ============================================================================
 *
 * POST /api/v1/onboarding/saccos/:id/mtn/setup
 *
 * This route belongs to onboarding readiness.
 *
 * Actual payment provider integration MUST remain in the payment-provider
 * subsystem.
 * ============================================================================
 */

router.post(
  "/saccos/:id/mtn/setup",

  objectIdParam("id"),

  rateLimiter,

  authorize("MOMO_SETUP"),

  idempotent({
    operation: "SACCO_MTN_SETUP",
    required: true,
  }),

  audit("SACCO_MTN_SETUP"),

  controller.setupMtnMomo ||
    ((req, res) =>
      res.status(501).json({
        success: false,
        code: "MOMO_SETUP_NOT_IMPLEMENTED",
        message:
          "MTN MoMo setup not implemented",
      }))
);

/**
 * ============================================================================
 * AIRTEL MONEY SETUP
 * ============================================================================
 *
 * POST /api/v1/onboarding/saccos/:id/airtel/setup
 * ============================================================================
 */

router.post(
  "/saccos/:id/airtel/setup",

  objectIdParam("id"),

  rateLimiter,

  authorize("AIRTEL_SETUP"),

  idempotent({
    operation: "SACCO_AIRTEL_SETUP",
    required: true,
  }),

  audit("SACCO_AIRTEL_SETUP"),

  controller.setupAirtelMoney ||
    ((req, res) =>
      res.status(501).json({
        success: false,
        code: "AIRTEL_SETUP_NOT_IMPLEMENTED",
        message:
          "Airtel Money setup not implemented",
      }))
);

/**
 * ============================================================================
 * EXPORT
 * ============================================================================
 */

module.exports = router;