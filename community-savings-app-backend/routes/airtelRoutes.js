// backend/routes/airtelRoutes.js
/**
 * ============================================================================
 * AIRTEL MONEY ROUTES
 * ============================================================================
 *
 * TITech Community Capital
 *
 * Endpoints
 *
 * POST /deposit
 * POST /withdraw
 * POST /repay-loan
 * POST /contribute-savings
 * POST /disburse
 * POST /bulk-disburse
 *
 * POST /webhook
 *
 * GET /status/:reference
 * GET /reconciliation/:date
 *
 * Additional:
 * GET /health
 * GET /metrics
 *
 * ============================================================================
 */

const express = require("express");

const router = express.Router();

const airtelController = require("../controllers/airtelController");

/**
 * ============================================================================
 * OPTIONAL MIDDLEWARES
 * ============================================================================
 */

let authenticate;
let authorize;
let rateLimiter;
let idempotency;

try {
  authenticate =
    require("../middleware/authMiddleware");
} catch {
  authenticate = (req, res, next) =>
    next();
}

try {
  authorize =
    require("../middleware/authorize");
} catch {
  authorize = () => (req, res, next) =>
    next();
}

try {
  rateLimiter =
    require("../middleware/rateLimiter");
} catch {
  rateLimiter = (req, res, next) =>
    next();
}

try {
  idempotency =
    require("../middleware/idempotency");
} catch {
  idempotency = (req, res, next) =>
    next();
}

/**
 * ============================================================================
 * VALIDATION MIDDLEWARE
 * ============================================================================
 */

function validateReference(
  req,
  res,
  next
) {
  const { reference } =
    req.params;

  if (!reference) {
    return res.status(400).json({
      success: false,
      message:
        "Reference parameter required",
    });
  }

  next();
}

function validateDate(
  req,
  res,
  next
) {
  const { date } =
    req.params;

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid reconciliation date",
    });
  }

  next();
}

/**
 * ============================================================================
 * COLLECTIONS
 * ============================================================================
 */

router.post(
  "/deposit",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "MEMBER"
  ),
  rateLimiter,
  idempotency,
  airtelController.deposit
);

router.post(
  "/repay-loan",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "MEMBER"
  ),
  rateLimiter,
  idempotency,
  airtelController.repayLoan
);

router.post(
  "/contribute-savings",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "MEMBER"
  ),
  rateLimiter,
  idempotency,
  airtelController.contributeSavings
);

/**
 * ============================================================================
 * DISBURSEMENTS
 * ============================================================================
 */

router.post(
  "/withdraw",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER"
  ),
  rateLimiter,
  idempotency,
  airtelController.withdraw
);

router.post(
  "/disburse",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER"
  ),
  rateLimiter,
  idempotency,
  airtelController.disburse
);

router.post(
  "/bulk-disburse",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER"
  ),
  rateLimiter,
  idempotency,
  airtelController.bulkDisburse
);

/**
 * ============================================================================
 * WEBHOOK
 * ============================================================================
 *
 * Airtel callbacks bypass JWT auth.
 * Verification occurs in webhook service.
 *
 * ============================================================================
 */

router.post(
  "/webhook",
  airtelController.webhook
);

/**
 * ============================================================================
 * STATUS
 * ============================================================================
 */

router.get(
  "/status/:reference",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "MEMBER"
  ),
  validateReference,
  airtelController.getStatus
);

/**
 * ============================================================================
 * RECONCILIATION
 * ============================================================================
 */

router.get(
  "/reconciliation/:date",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "AUDITOR"
  ),
  validateDate,
  airtelController.getReconciliation
);

/**
 * ============================================================================
 * HEALTH
 * ============================================================================
 */

router.get(
  "/health",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "AUDITOR"
  ),
  airtelController.health
);

/**
 * ============================================================================
 * METRICS
 * ============================================================================
 */

router.get(
  "/metrics",
  authenticate,
  authorize(
    "ADMIN",
    "TREASURER",
    "AUDITOR"
  ),
  airtelController.metrics
);

/**
 * ============================================================================
 * NOT FOUND HANDLER
 * ============================================================================
 */

router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message:
      "Airtel endpoint not found",
    path: req.originalUrl,
    timestamp:
      new Date().toISOString(),
  });
});

module.exports = router;