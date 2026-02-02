// controllers/emailController.js
// ============================================================================
// Email Verification & Password Reset Controller
// - Production-grade token handling with expiry and rate limiting
// - Email service abstraction for SendGrid, AWS SES, Mailgun, etc.
// - Audit logging for security events
// - Idempotency and error recovery
// ============================================================================

const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const EmailAudit = require('../models/EmailAudit');
const rateLimit = require('express-rate-limit');

// Rate limiters for abuse prevention
const requestVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // 3 requests per hour per email
  keyGenerator: (req) => req.body?.email || req.ip,
  message: 'Too many verification requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const requestResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 requests per hour per email
  keyGenerator: (req) => req.body?.email || req.ip,
  message: 'Too many password reset requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // 3 reset attempts per hour
  keyGenerator: (req) => req.ip,
  message: 'Too many password reset attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 verification attempts per hour
  keyGenerator: (req) => req.ip,
  message: 'Too many verification attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Log email operations for security and debugging
 */
async function auditEmailEvent(event, userId, email, metadata = {}, success = true) {
  try {
    await EmailAudit.create({
      event,
      userId: userId || null,
      email: email?.toLowerCase() || null,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
      status: success ? 'success' : 'failed',
      reason: metadata.reason || null,
      metadata,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error('[EmailAudit] Failed to log event', {
      event,
      error: err.message,
    });
  }
}

// ============================================================================
// Public Endpoints
// ============================================================================

/**
 * POST /api/auth/send-verification-email
 * Sends verification email to user (or authenticated user's email).
 * Rate limited to prevent abuse.
 */
async function sendVerificationEmailRequest(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal user existence (security best practice)
      return res.status(200).json({
        message: 'If the email exists and is not verified, a verification link has been sent.',
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        message: 'Email is already verified.',
      });
    }

    // Generate verification token
    const verificationToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    try {
      await sendVerificationEmail(user.email, user.name, verificationUrl);
      await auditEmailEvent(
        'send_verification_email',
        user._id,
        user.email,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
        true
      );

      logger.info('[EmailController] Verification email sent', {
        userId: user._id,
        email: user.email,
      });

      return res.status(200).json({
        message: 'Verification email sent successfully.',
      });
    } catch (emailError) {
      // Rollback token if email fails
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save({ validateBeforeSave: false });

      await auditEmailEvent(
        'send_verification_email',
        user._id,
        user.email,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: emailError.message,
        },
        false
      );

      logger.error('[EmailController] Failed to send verification email', {
        userId: user._id,
        error: emailError.message,
      });

      return res.status(500).json({
        message: 'Failed to send verification email. Please try again later.',
      });
    }
  } catch (err) {
    logger.error('[EmailController] sendVerificationEmailRequest error', err);
    return res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
}

/**
 * POST /api/auth/verify-email
 * Verifies email using the token sent to user's email.
 */
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: 'Verification token is required.',
      });
    }

    // Hash token to match against stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      await auditEmailEvent(
        'verify_email',
        null,
        null,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: 'Invalid or expired token',
        },
        false
      );

      return res.status(400).json({
        message: 'Invalid or expired verification token.',
      });
    }

    // Mark email as verified
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save({ validateBeforeSave: false });

    await auditEmailEvent(
      'verify_email',
      user._id,
      user.email,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
      true
    );

    logger.info('[EmailController] Email verified successfully', {
      userId: user._id,
      email: user.email,
    });

    return res.status(200).json({
      message: 'Email verified successfully. You can now log in.',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    logger.error('[EmailController] verifyEmail error', err);
    return res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
}

/**
 * POST /api/auth/request-password-reset
 * Initiates password reset flow by sending reset link to email.
 */
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal user existence (security best practice)
      return res.status(200).json({
        message: 'If an account exists for this email, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);

      await auditEmailEvent(
        'request_password_reset',
        user._id,
        user.email,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
        true
      );

      logger.info('[EmailController] Password reset email sent', {
        userId: user._id,
        email: user.email,
      });

      return res.status(200).json({
        message: 'Password reset link has been sent to your email.',
      });
    } catch (emailError) {
      // Rollback token if email fails
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save({ validateBeforeSave: false });

      await auditEmailEvent(
        'request_password_reset',
        user._id,
        user.email,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: emailError.message,
        },
        false
      );

      logger.error('[EmailController] Failed to send password reset email', {
        userId: user._id,
        error: emailError.message,
      });

      return res.status(500).json({
        message: 'Failed to send password reset email. Please try again later.',
      });
    }
  } catch (err) {
    logger.error('[EmailController] requestPasswordReset error', err);
    return res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
}

/**
 * POST /api/auth/reset-password
 * Completes password reset using the token and new password.
 */
async function resetPassword(req, res, next) {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        message: 'Token, password, and password confirmation are required.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Passwords do not match.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters.',
      });
    }

    // Hash token to match against stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      await auditEmailEvent(
        'reset_password',
        null,
        null,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: 'Invalid or expired token',
        },
        false
      );

      return res.status(400).json({
        message: 'Invalid or expired password reset token.',
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    // Reset failed login attempts on successful password change
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    await auditEmailEvent(
      'reset_password',
      user._id,
      user.email,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
      true
    );

    logger.info('[EmailController] Password reset successfully', {
      userId: user._id,
      email: user.email,
    });

    return res.status(200).json({
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    logger.error('[EmailController] resetPassword error', err);
    return res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
}

/**
 * POST /api/auth/change-password
 * Changes password for authenticated user (requires old password).
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: 'Not authenticated.',
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'Current password, new password, and confirmation are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'New passwords do not match.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'New password must be different from current password.',
      });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      await auditEmailEvent(
        'change_password',
        user._id,
        user.email,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: 'Invalid current password',
        },
        false
      );

      return res.status(401).json({
        message: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    await user.save();

    await auditEmailEvent(
      'change_password',
      user._id,
      user.email,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
      true
    );

    logger.info('[EmailController] Password changed successfully', {
      userId: user._id,
      email: user.email,
    });

    return res.status(200).json({
      message: 'Password changed successfully.',
    });
  } catch (err) {
    logger.error('[EmailController] changePassword error', err);
    return res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
}

module.exports = {
  // Rate limiters for use in routes
  requestVerificationLimiter,
  requestResetLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,

  // Controllers
  sendVerificationEmailRequest,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
};
