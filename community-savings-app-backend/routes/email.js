// routes/email.js
// ============================================================================
// Email Routes
// - Email verification
// - Password reset and recovery
// - Password change
// - Rate limiting and security
// ============================================================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../middleware/auth');
const emailController = require('../controllers/emailController');

const router = express.Router();

// ============================================================================
// Middleware
// ============================================================================

/**
 * Validation error handler
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation error',
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
}

// ============================================================================
// Public Routes (no authentication required)
// ============================================================================

/**
 * POST /api/email/send-verification
 * Sends verification email to user's email address
 * Rate limited: 3 per hour per email
 */
router.post(
  '/send-verification',
  emailController.requestVerificationLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  handleValidationErrors,
  asyncHandler(emailController.sendVerificationEmailRequest)
);

/**
 * POST /api/email/verify
 * Verifies email using token sent to user's email
 * Rate limited: 5 per hour per IP
 */
router.post(
  '/verify',
  emailController.verifyEmailLimiter,
  [
    body('token')
      .trim()
      .notEmpty()
      .withMessage('Verification token is required')
      .isLength({ min: 40, max: 40 })
      .withMessage('Invalid token format'),
  ],
  handleValidationErrors,
  asyncHandler(emailController.verifyEmail)
);

/**
 * POST /api/email/request-password-reset
 * Initiates password reset flow
 * Rate limited: 5 per hour per email
 */
router.post(
  '/request-password-reset',
  emailController.requestResetLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  handleValidationErrors,
  asyncHandler(emailController.requestPasswordReset)
);

/**
 * POST /api/email/reset-password
 * Completes password reset with token
 * Rate limited: 3 per hour per IP
 */
router.post(
  '/reset-password',
  emailController.resetPasswordLimiter,
  [
    body('token')
      .trim()
      .notEmpty()
      .withMessage('Reset token is required')
      .isLength({ min: 40, max: 40 })
      .withMessage('Invalid token format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Password confirmation is required'),
  ],
  handleValidationErrors,
  asyncHandler(emailController.resetPassword)
);

// ============================================================================
// Protected Routes (authentication required)
// ============================================================================

/**
 * POST /api/email/change-password
 * Changes password for authenticated user
 * Requires current password verification
 */
router.post(
  '/change-password',
  verifyToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Password confirmation is required'),
  ],
  handleValidationErrors,
  asyncHandler(emailController.changePassword)
);

/**
 * POST /api/email/resend-verification
 * Resends verification email for authenticated user
 */
router.post(
  '/resend-verification',
  verifyToken,
  emailController.requestVerificationLimiter,
  asyncHandler(async (req, res) => {
    const { sendVerificationEmailRequest } = emailController;
    req.body = { email: req.user.email };
    await sendVerificationEmailRequest(req, res);
  })
);

module.exports = router;
