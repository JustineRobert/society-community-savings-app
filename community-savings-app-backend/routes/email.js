// community-savings-app-backend/routes/email.js

/**
 * Email Routes
 *
 * Comprehensive email API endpoints supporting:
 * - Email verification
 * - Password reset
 * - Email testing and configuration
 */

const express = require('express');
const router = express.Router();

const { body } = require('express-validator');

const asyncHandler = require('../utils/asyncHandler');

const { handleValidationErrors } = require('../utils/validators');

const { verifyToken } = require('../middleware/auth');

const emailController = require('../controllers/emailController');

/**
 * All routes require authentication except password reset initiation and email verification
 */

// ============================================================================
// Public Routes (No Authentication Required)
// ============================================================================

/**
 * Verify email with token
 * POST /api/email/verify
 */
router.post(
  '/verify',
  [body('token').notEmpty().withMessage('Verification token is required'), handleValidationErrors],
  emailController.verifyEmail
);

/**
 * Send password reset email
 * POST /api/email/send-password-reset
 */
router.post(
  '/send-password-reset',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    handleValidationErrors
  ],
  emailController.sendPasswordReset
);

/**
 * Reset password with token
 * POST /api/email/reset-password
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    handleValidationErrors,
  ],
  emailController.resetPassword
);

// ============================================================================
// Protected Routes (Authentication Required)
// ============================================================================

/**
 * Send email verification (authenticated user)
 * POST /api/email/send-verification
 */
router.post(
  '/send-verification',
  verifyToken,
  emailController.sendEmailVerification
);

/**
 * Resend email verification
 * POST /api/email/resend-verification
 */
router.post(
  '/resend-verification', 
  verifyToken, 
  emailController.resendEmailVerification
);

/**
 * Get email verification status
 * GET /api/email/verification-status
 */
router.get(
  '/verification-status', 
  verifyToken, 
  emailController.getEmailVerificationStatus
);

/**
 * Test email configuration (admin only)
 * POST /api/email/test
 */
router.post(
  '/test', 
  verifyToken, 
  emailController.testEmailConfiguration
);

/**
 * Send test email (admin only)
 * POST /api/email/test-send
 */
// ✅ Test email route (already correct)
router.post(
  '/test-send',
  verifyToken,
  [
    body('to').isEmail().withMessage('Valid recipient email is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required'),
    handleValidationErrors,
  ],
  emailController.sendTestEmail
);

// ✅ Verification email route (FIXED)
router.post(
  '/send-verification',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  handleValidationErrors,
  asyncHandler(emailController.sendVerificationEmailRequest)
);

module.exports = router;
``;

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
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
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
    body('confirmPassword').notEmpty().withMessage('Password confirmation is required'),
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
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('confirmPassword').notEmpty().withMessage('Password confirmation is required'),
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
