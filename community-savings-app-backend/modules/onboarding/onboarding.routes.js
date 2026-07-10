/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Routes
 * ============================================================
 */

const express = require("express");

const router = express.Router();

const controller = require("./onboarding.controller");

/**
 * ============================================================
 * VALIDATIONS
 * ============================================================
 */
const {
  validateSacco,
  validateKYC,
  validateSubscription,
  validateRejection
} = require("./onboarding.validation");

/**
 * ============================================================
 * SECURITY
 * ============================================================
 */
const authenticate =
  require("../../middleware/auth.middleware");

const authorize =
  require("../../middleware/rbac.middleware");

const tenantMiddleware =
  require("../../tenancy/tenant.middleware");

/**
 * ============================================================
 * FILE UPLOADS
 * ============================================================
 */
const upload =
  require("../../middleware/upload.middleware");

/**
 * ============================================================
 * RATE LIMITING
 * ============================================================
 */
const rateLimiter =
  require("../../security/rateLimiting");

/**
 * ============================================================
 * GLOBAL ROUTE SECURITY
 * ============================================================
 */

router.use(authenticate);
router.use(tenantMiddleware);

/**
 * ============================================================
 * CREATE SACCO
 * POST /api/v1/onboarding/saccos
 * ============================================================
 */
router.post(
  "/saccos",
  rateLimiter,
  authorize("SACCO_CREATE"),
  validateSacco,
  controller.registerSacco
);

/**
 * ============================================================
 * GET ALL SACCOS
 * GET /api/v1/onboarding/saccos
 * ============================================================
 */
router.get(
  "/saccos",
  authorize("SACCO_VIEW"),
  controller.getAllSaccos
);

/**
 * ============================================================
 * GET SACCO BY ID
 * GET /api/v1/onboarding/saccos/:id
 * ============================================================
 */
router.get(
  "/saccos/:id",
  authorize("SACCO_VIEW"),
  controller.getSaccoById
);

/**
 * ============================================================
 * VERIFY KYC
 * PUT /api/v1/onboarding/saccos/:id/kyc
 * ============================================================
 */
router.put(
  "/saccos/:id/kyc",
  authorize("SACCO_KYC_APPROVE"),
  validateKYC,
  controller.verifyKYC
);

/**
 * ============================================================
 * UPLOAD KYC DOCUMENTS
 * POST /api/v1/onboarding/saccos/:id/documents
 * ============================================================
 */
router.post(
  "/saccos/:id/documents",
  authorize("SACCO_KYC_UPLOAD"),
  upload.array("documents", 20),
  controller.uploadDocuments
);

/**
 * ============================================================
 * SETUP SUBSCRIPTION
 * PUT /api/v1/onboarding/saccos/:id/subscription
 * ============================================================
 */
router.put(
  "/saccos/:id/subscription",
  authorize("SACCO_SUBSCRIPTION"),
  validateSubscription,
  controller.setupSubscription
);

/**
 * ============================================================
 * GET ONBOARDING PROGRESS
 * GET /api/v1/onboarding/saccos/:id/progress
 * ============================================================
 */
router.get(
  "/saccos/:id/progress",
  authorize("SACCO_VIEW"),
  controller.getOnboardingProgress
);

/**
 * ============================================================
 * GO LIVE
 * PUT /api/v1/onboarding/saccos/:id/live
 * ============================================================
 */
router.put(
  "/saccos/:id/live",
  authorize("SACCO_GO_LIVE"),
  controller.goLive
);

/**
 * ============================================================
 * REJECT APPLICATION
 * PUT /api/v1/onboarding/saccos/:id/reject
 * ============================================================
 */
router.put(
  "/saccos/:id/reject",
  authorize("SACCO_REJECT"),
  validateRejection,
  controller.rejectApplication
);

/**
 * ============================================================
 * DASHBOARD METRICS
 * GET /api/v1/onboarding/metrics
 * ============================================================
 */
router.get(
  "/metrics",
  authorize("SACCO_ANALYTICS"),
  controller.getOnboardingMetrics
);

/**
 * ============================================================
 * MTN MOMO READINESS
 * FUTURE PHASE
 * ============================================================
 */
router.post(
  "/saccos/:id/mtn/setup",
  authorize("MOMO_SETUP"),
  controller.setupMtnMomo || ((req, res) =>
    res.status(501).json({
      success: false,
      message: "MTN MoMo setup not implemented"
    }))
);

/**
 * ============================================================
 * AIRTEL MONEY READINESS
 * FUTURE PHASE
 * ============================================================
 */
router.post(
  "/saccos/:id/airtel/setup",
  authorize("AIRTEL_SETUP"),
  controller.setupAirtelMoney || ((req, res) =>
    res.status(501).json({
      success: false,
      message: "Airtel Money setup not implemented"
    }))
);

/**
 * ============================================================
 * EXPORT
 * ============================================================
 */
module.exports = router;