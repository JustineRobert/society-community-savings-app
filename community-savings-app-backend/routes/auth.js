// routes/auth.js
// ============================================================================
// Authentication Routes
// - Registration
// - Login
// - Refresh Token Rotation
// - Logout / Logout All
// - User Profile
// - Session Management
// ============================================================================

const express = require('express');
const rateLimit = require('express-rate-limit');

const asyncHandler = require('../utils/asyncHandler');
const { validationRules, handleValidation } = require('../utils/validators');
const { verifyToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// ============================================================================
// RATE LIMITERS
// ============================================================================

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many refresh attempts. Please wait before retrying.',
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many account creation attempts. Please try again later.',
});

// ============================================================================
// PUBLIC AUTH ROUTES
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
  asyncHandler(authController.logout)
);

// ============================================================================
// PROTECTED USER ROUTES
// ============================================================================

router.post(
  '/logout-all',
  verifyToken,
  asyncHandler(authController.logoutAll)
);

router.get(
  '/me',
  verifyToken,
  asyncHandler(authController.me)
);

router.get(
  '/sessions',
  verifyToken,
  asyncHandler(authController.listSessions)
);

router.delete(
  '/sessions/:id',
  verifyToken,
  asyncHandler(authController.revokeSession)
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

router.get(
  '/admin/sessions',
  verifyToken,
  requireRole('admin'),
  asyncHandler(authController.adminListSessions)
);

router.delete(
  '/admin/sessions/:id',
  verifyToken,
  requireRole('admin'),
  asyncHandler(authController.adminRevokeSession)
);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;