'use strict';

// ============================================================================
// TITech Community Capital
// Enterprise Authentication Routes
// Production Grade
// ============================================================================

const express = require('express');
const rateLimit = require('express-rate-limit');

const asyncHandler = require('../utils/asyncHandler');
const { validationRules, handleValidation } = require('../utils/validators');

const {
  authenticate,
  requireRole,
} = require('../middleware/auth');

const authController = require('../controllers/authController');

const router = express.Router();

// ============================================================================
// CONTROLLER VALIDATION
// ============================================================================

const REQUIRED_HANDLERS = [
  'register',
  'login',
  'refresh',
  'logout',
  'logoutAll',
  'me',
  'listSessions',
  'revokeSession',
  'adminListSessions',
  'adminRevokeSession',
];

for (const handler of REQUIRED_HANDLERS) {
  if (typeof authController[handler] !== 'function') {
    throw new Error(
      `[Auth Routes] Missing controller export: ${handler}`
    );
  }
}

// ============================================================================
// RATE LIMIT HELPERS
// ============================================================================

const isDevelopment =
  process.env.NODE_ENV !== 'production';

function skipLocalhost(req) {
  if (!isDevelopment) return false;

  const ip =
    req.ip ||
    req.connection?.remoteAddress ||
    '';

  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.includes('127.0.0.1')
  );
}

function createLimiter({
  windowMs,
  max,
  message,
}) {
  return rateLimit({
    windowMs,
    max,

    standardHeaders: true,
    legacyHeaders: false,

    skipSuccessfulRequests: true,

    skip: skipLocalhost,

    keyGenerator(req) {
      return (
        req.ip ||
        req.headers['x-forwarded-for'] ||
        'unknown'
      );
    },

    handler(req, res) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message,
        retryAfter:
          Math.ceil(windowMs / 1000),
      });
    },
  });
}

// ============================================================================
// LIMITERS
// ============================================================================

const registerLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message:
    'Too many registration attempts. Please try again later.',
});

const loginLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message:
    'Too many login attempts. Please try again later.',
});

const refreshLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message:
    'Too many token refresh requests.',
});

const logoutLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message:
    'Too many logout requests.',
});

const sessionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message:
    'Too many session requests.',
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

router.post(
  '/register',
  registerLimiter,
  validationRules.register,
  handleValidation,
  asyncHandler(authController.register)
);

router.post(
  '/login',
  loginLimiter,
  validationRules.login,
  handleValidation,
  asyncHandler(authController.login)
);

router.post(
  '/refresh',
  refreshLimiter,
  asyncHandler(authController.refresh)
);

router.post(
  '/logout',
  logoutLimiter,
  asyncHandler(authController.logout)
);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

router.post(
  '/logout-all',
  authenticate,
  sessionLimiter,
  asyncHandler(authController.logoutAll)
);

router.get(
  '/me',
  authenticate,
  asyncHandler(authController.me)
);

router.get(
  '/sessions',
  authenticate,
  sessionLimiter,
  asyncHandler(authController.listSessions)
);

router.delete(
  '/sessions/:id',
  authenticate,
  sessionLimiter,
  asyncHandler(authController.revokeSession)
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

router.get(
  '/admin/sessions',
  authenticate,
  requireRole('admin'),
  sessionLimiter,
  asyncHandler(authController.adminListSessions)
);

router.delete(
  '/admin/sessions/:id',
  authenticate,
  requireRole('admin'),
  sessionLimiter,
  asyncHandler(authController.adminRevokeSession)
);

// ============================================================================
// HEALTH / STATUS
// ============================================================================

router.get(
  '/status',
  authenticate,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      authenticated: true,
      service: 'auth',
      timestamp: new Date().toISOString(),
      user: {
        id: req.user.id,
        role: req.user.role,
      },
    });
  })
);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;