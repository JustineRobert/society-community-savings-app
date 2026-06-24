// backend/routes/mtnRoutes.js
/**
 * ============================================================================
 * MTN MOMO ROUTES
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

const mtnController = require("../controllers/mtnController");

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
 * REQUEST VALIDATION
 * ============================================================================
 */

function validateReference(
  req,
  res,
  next
) {
  const { reference } = req.params;

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
  const { date } = req.params;

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
 * MTN COLLECTIONS
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
  mtnController.deposit
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
  mtnController.repayLoan
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
  mtnController.contributeSavings
);

/**
 * ============================================================================
 * MTN DISBURSEMENTS
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
  mtnController.withdraw
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
  mtnController.disburse
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
  mtnController.bulkDisburse
);

/**
 * ============================================================================
 * WEBHOOK
 * ============================================================================
 *
 * MTN callbacks must bypass
 * normal JWT authentication.
 *
 * Validation is performed
 * inside webhook service.
 *
 * ============================================================================
 */

router.post(
  "/webhook",
  mtnController.webhook
);

/**
 * ============================================================================
 * TRANSACTION STATUS
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
  mtnController.getStatus
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
  mtnController.getReconciliation
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
  mtnController.health
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
  mtnController.metrics
);

/**
 * ============================================================================
 * 404 HANDLER
 * ============================================================================
 */

router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message:
      "MTN endpoint not found",
    path: req.originalUrl,
    timestamp:
      new Date().toISOString(),
  });
});

module.exports = router;