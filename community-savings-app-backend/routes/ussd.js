// ============================================================================
// TITech Community Capital
// Enterprise USSD Routes
// File: backend/routes/ussd.js
// Production Grade
// ============================================================================

"use strict";

const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const ussdController =
  require("../controllers/ussdController");

const authenticate =
  require("../middleware/authenticate");

const authenticateTenant =
  require("../middleware/authenticateTenant");

const featureGuard =
  require("../middleware/featureGuard");

const correlationMiddleware =
  require("../middleware/correlationMiddleware");

const requestContext =
  require("../middleware/requestContext");

const auditMiddleware =
  require("../middleware/auditMiddleware");

const logger =
  require("../utils/logger");

const metrics =
  require("../services/metricsService");

const ussdSessionService =
  require("../services/ussdSessionService");

const tenantService =
  require("../services/tenantService");

const { FEATURES } =
  require("../constants/features");

// ============================================================================
// Config
// ============================================================================

const REQUEST_TIMEOUT =
  Number(
    process.env.USSD_REQUEST_TIMEOUT ||
      25000
  );

const BODY_LIMIT =
  process.env.USSD_MAX_BODY_SIZE ||
  "100kb";

const VERIFY_SIGNATURE =
  process.env.USSD_VERIFY_SIGNATURE ===
  "true";

// ============================================================================
// Body Parsers
// ============================================================================

router.use(
  express.urlencoded({
    extended: true,
    limit: BODY_LIMIT,
  })
);

router.use(
  express.json({
    limit: BODY_LIMIT,
  })
);

// ============================================================================
// Context Middleware
// ============================================================================

router.use(
  correlationMiddleware
);

router.use(requestContext);

// ============================================================================
// Metrics
// ============================================================================

router.use(
  (req, res, next) => {
    req.startedAt = Date.now();

    metrics.increment(
      "ussd_requests_total"
    );

    next();
  }
);

// ============================================================================
// Rate Limiting
// ============================================================================

router.use(
  rateLimit({
    windowMs: 60 * 1000,

    max: Number(
      process.env.USSD_RATE_LIMIT ||
        1000
    ),

    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator(req) {
      return (
        req.body.phoneNumber ||
        req.ip
      );
    },

    handler(req, res) {
      metrics.increment(
        "ussd_rate_limit_exceeded_total"
      );

      logger.warn(
        "USSD rate limit exceeded",
        {
          ip: req.ip,
          phone:
            req.body.phoneNumber,
        }
      );

      return res
        .status(429)
        .send(
          "END Too many requests. Please try again later."
        );
    },
  })
);

// ============================================================================
// Validation
// ============================================================================

function validateRequest(
  req,
  res,
  next
) {
  const {
    sessionId,
    phoneNumber,
  } = req.body;

  if (!sessionId) {
    return res
      .status(400)
      .send(
        "END Invalid session."
      );
  }

  if (!phoneNumber) {
    return res
      .status(400)
      .send(
        "END Invalid phone number."
      );
  }

  next();
}

// ============================================================================
// Signature Verification
// ============================================================================

function verifySignature(
  req,
  res,
  next
) {
  if (!VERIFY_SIGNATURE) {
    return next();
  }

  try {
    const signature =
      req.headers[
        "x-signature"
      ];

    if (!signature) {
      return res
        .status(401)
        .send(
          "END Unauthorized."
        );
    }

    const secret =
      process.env.USSD_WEBHOOK_SECRET;

    const payload =
      JSON.stringify(req.body);

    const hash =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(payload)
        .digest("hex");

    if (hash !== signature) {
      logger.warn(
        "Invalid USSD signature"
      );

      return res
        .status(401)
        .send(
          "END Unauthorized."
        );
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Idempotency
// ============================================================================

async function idempotency(
  req,
  res,
  next
) {
  try {
    const key =
      crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            sessionId:
              req.body.sessionId,
            text:
              req.body.text,
            phone:
              req.body.phoneNumber,
          })
        )
        .digest("hex");

    req.idempotencyKey = key;

    const cached =
      await ussdSessionService.getResponse(
        key
      );

    if (cached) {
      return res.send(
        cached
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Request Timeout
// ============================================================================

function requestTimeout(
  req,
  res,
  next
) {
  const timer =
    setTimeout(() => {
      if (!res.headersSent) {
        logger.error(
          "USSD request timeout",
          {
            sessionId:
              req.body.sessionId,
          }
        );

        res.send(
          "END Service unavailable."
        );
      }
    }, REQUEST_TIMEOUT);

  res.on(
    "finish",
    () =>
      clearTimeout(timer)
  );

  next();
}

// ============================================================================
// Health
// ============================================================================

router.get(
  "/health",
  async (req, res) => {
    res.json({
      success: true,
      service: "ussd",
      uptime:
        process.uptime(),
      timestamp:
        new Date().toISOString(),
    });
  }
);

// ============================================================================
// Metrics
// ============================================================================

router.get(
  "/metrics",
  async (req, res) => {
    const data =
      await metrics.getMetrics();

    res.json(data);
  }
);

// ============================================================================
// Main USSD Endpoint
// ============================================================================

router.post(
  "/",
  validateRequest,
  verifySignature,
  requestTimeout,
  idempotency,
  authenticateTenant,
  featureGuard(
    FEATURES.USSD
  ),
  auditMiddleware,
  async (
    req,
    res,
    next
  ) => {
    try {
      const tenant =
        await tenantService.findById(
          req.tenant.id
        );

      if (!tenant) {
        return res.send(
          "END Invalid tenant."
        );
      }

      const response =
        await ussdController.handle({
          tenant,
          sessionId:
            req.body.sessionId,
          serviceCode:
            req.body.serviceCode,
          phoneNumber:
            req.body.phoneNumber,
          text:
            req.body.text || "",
          correlationId:
            req.correlationId,
          requestId:
            req.requestId,
        });

      await ussdSessionService.saveResponse(
        req.idempotencyKey,
        response
      );

      metrics.increment(
        "ussd_responses_total"
      );

      res.send(response);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Session Lookup
// ============================================================================

router.get(
  "/sessions/:sessionId",
  authenticate,
  async (
    req,
    res,
    next
  ) => {
    try {
      const session =
        await ussdSessionService.findSession(
          req.params.sessionId
        );

      if (!session) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Session not found",
          });
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Session Termination
// ============================================================================

router.delete(
  "/sessions/:sessionId",
  authenticate,
  async (
    req,
    res,
    next
  ) => {
    try {
      await ussdSessionService.endSession(
        req.params.sessionId
      );

      res.json({
        success: true,
        message:
          "Session terminated",
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Metrics Recording
// ============================================================================

router.use(
  (req, res, next) => {
    if (req.startedAt) {
      metrics.timing(
        "ussd_response_time_ms",
        Date.now() -
          req.startedAt
      );
    }

    next();
  }
);

// ============================================================================
// Error Handler
// ============================================================================

router.use(
  (
    err,
    req,
    res,
    next
  ) => {
    logger.error(
      "USSD route failure",
      {
        message:
          err.message,
        stack:
          err.stack,
        sessionId:
          req.body?.sessionId,
        correlationId:
          req.correlationId,
        tenantId:
          req.tenant?.id,
      }
    );

    metrics.increment(
      "ussd_errors_total"
    );

    if (!res.headersSent) {
      return res
        .status(500)
        .send(
          "END An unexpected error occurred."
        );
    }

    next(err);
  }
);

// ============================================================================

module.exports = router;