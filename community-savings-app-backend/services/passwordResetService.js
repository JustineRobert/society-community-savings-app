/**
 * Password Reset Service
 * Handles password reset flows with secure token generation, validation, and password reset
 * Enforces strong password requirements and single-use tokens
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const PasswordResetToken = require('../models/PasswordResetToken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Password strength validation using zxcvbn (if available) or custom rules
const validatePasswordStrength = (password) => {
  // Minimum 12 characters, must include uppercase, lowercase, number, special char
  const rules = {
    minLength: password.length >= 12,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const passedRules = Object.values(rules).filter(Boolean).length;
  const allRulesPassed = Object.values(rules).every(Boolean);

  return {
    valid: allRulesPassed,
    score: passedRules,
    rules,
    message: allRulesPassed
      ? null
      : 'Password must be at least 12 characters and include uppercase, lowercase, number, and special character',
  };
};

// Hash token using SHA256 for secure storage
const HASH_TOKEN = (token) => crypto.createHash('sha256').update(token).digest('hex');

class PasswordResetService {
  constructor(config = {}) {
    this.tokenTTL = config.tokenTTL || 1 * 60 * 60 * 1000; // 1 hour default (shorter than email verification)
    this.maxAttempts = config.maxAttempts || 5; // Max 5 attempts per token
    this.attemptWindowMs = config.attemptWindowMs || 10 * 60 * 1000; // 10 minutes
    this.emailService = config.emailService || null;
    this.sessionService = config.sessionService || null; // For invalidating sessions after reset
  }

  /**
   * Create password reset token and send email
   * @param {Object} user - User document with _id, email, name
   * @returns {string} - Plain token (send to user via email, never store)
   */
  async createResetToken(user) {
    try {
      // Generate cryptographically secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = HASH_TOKEN(token);
      const expiresAt = new Date(Date.now() + this.tokenTTL);

      // Store hashed token (never raw token)
      const record = await PasswordResetToken.create({
        user: user._id,
        tokenHash,
        expiresAt,
        attempts: 0,
      });

      logger.info('[PasswordResetService] Password reset token created', {
        userId: user._id,
        tokenId: record._id,
        expiresAt,
      });

      // Send email with reset link
      if (this.emailService) {
        await this.emailService.sendPasswordReset(user.email, {
          userId: user._id,
          name: user.name || user.email.split('@')[0],
          token, // Send unhashed token in URL
          frontendResetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}&id=${user._id}`,
          expiresInHours: Math.ceil(this.tokenTTL / (60 * 60 * 1000)),
        });

        logger.info('[PasswordResetService] Password reset email sent', {
          userId: user._id,
          email: user.email,
        });
      }

      return token;
    } catch (error) {
      logger.error('[PasswordResetService] Error creating reset token', {
        error: error.message,
        userId: user._id,
      });
      throw error;
    }
  }

  /**
   * Reset password using token
   * Validates token, password strength, and updates user password
   * @param {string} userId - User ID
   * @param {string} token - Plain reset token from URL
   * @param {string} newPassword - New password (will be validated for strength)
   * @returns {Object} - { success, message, user }
   */
  async resetPassword(userId, token, newPassword) {
    try {
      if (!userId || !token || !newPassword) {
        throw new Error('User ID, token, and new password are required');
      }

      // Validate password strength first (before checking token)
      const passwordStrength = validatePasswordStrength(newPassword);
      if (!passwordStrength.valid) {
        logger.warn('[PasswordResetService] Weak password provided', {
          userId,
          score: passwordStrength.score,
        });
        throw new Error(passwordStrength.message);
      }

      // Hash and lookup token
      const tokenHash = HASH_TOKEN(token);
      const tokenRecord = await PasswordResetToken.findOne({
        user: userId,
        tokenHash,
        used: false,
      });

      // Validate token exists
      if (!tokenRecord) {
        logger.warn('[PasswordResetService] Invalid reset token', {
          userId,
        });
        throw new Error('Invalid reset token. Please request a new password reset.');
      }

      // Check token expiration
      if (tokenRecord.expiresAt < new Date()) {
        logger.warn('[PasswordResetService] Reset token expired', {
          userId,
          expiresAt: tokenRecord.expiresAt,
        });
        throw new Error('Password reset token has expired. Please request a new one.');
      }

      // Check rate limiting (brute force prevention)
      if ((tokenRecord.attempts || 0) >= this.maxAttempts) {
        logger.error('[PasswordResetService] Max reset attempts exceeded', {
          userId,
          attempts: tokenRecord.attempts,
        });
        throw new Error('Maximum reset attempts exceeded. Please request a new password reset.');
      }

      // Increment attempts
      tokenRecord.attempts = (tokenRecord.attempts || 0) + 1;
      await tokenRecord.save();

      // Hash new password with bcrypt
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      // Update user's password
      const user = await User.findByIdAndUpdate(
        userId,
        {
          password: passwordHash,
          passwordResetAt: new Date(),
          passwordResetAttempts: 0, // Clear any previous brute force attempts
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Mark token as used (single-use constraint)
      tokenRecord.used = true;
      tokenRecord.usedAt = new Date();
      await tokenRecord.save();

      logger.info('[PasswordResetService] Password reset successfully', {
        userId,
        email: user.email,
        tokenUsedAfterAttempts: tokenRecord.attempts,
      });

      // Invalidate all sessions for this user (force re-login)
      if (this.sessionService && this.sessionService.invalidateUserSessions) {
        await this.sessionService.invalidateUserSessions(userId);
        logger.info('[PasswordResetService] User sessions invalidated after password reset', {
          userId,
        });
      }

      return {
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
        user: {
          id: user._id,
          email: user.email,
        },
      };
    } catch (error) {
      logger.error('[PasswordResetService] Error resetting password', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Verify reset token without performing password change
   * Useful for frontend validation before showing reset form
   * @param {string} userId - User ID
   * @param {string} token - Plain reset token
   * @returns {Object} - { valid, expiresAt, remainingMinutes }
   */
  async verifyResetToken(userId, token) {
    try {
      const tokenHash = HASH_TOKEN(token);
      const tokenRecord = await PasswordResetToken.findOne({
        user: userId,
        tokenHash,
        used: false,
      });

      if (!tokenRecord) {
        return {
          valid: false,
          reason: 'Invalid token',
        };
      }

      if (tokenRecord.expiresAt < new Date()) {
        return {
          valid: false,
          reason: 'Token expired',
          expiresAt: tokenRecord.expiresAt,
        };
      }

      const remainingMs = tokenRecord.expiresAt.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

      return {
        valid: true,
        expiresAt: tokenRecord.expiresAt,
        remainingMinutes,
        attemptsMade: tokenRecord.attempts,
        attemptsRemaining: this.maxAttempts - (tokenRecord.attempts || 0),
      };
    } catch (error) {
      logger.error('[PasswordResetService] Error verifying reset token', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Clean up expired reset tokens (useful for scheduled jobs)
   * @returns {number} - Number of deleted tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await PasswordResetToken.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      logger.info('[PasswordResetService] Expired reset tokens cleaned up', {
        deletedCount: result.deletedCount,
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('[PasswordResetService] Error cleaning up expired tokens', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get password reset status for user
   * @param {string} userId - User ID
   * @returns {Object} - { hasPendingReset, expiresAt, attemptsMade }
   */
  async getResetStatus(userId) {
    try {
      const pendingToken = await PasswordResetToken.findOne(
        { user: userId, used: false },
        { expiresAt: 1, attempts: 1 }
      );

      return {
        hasPendingReset: !!pendingToken,
        expiresAt: pendingToken && pendingToken.expiresAt,
        attemptsMade: pendingToken && (pendingToken.attempts || 0),
        attemptsRemaining: pendingToken && (this.maxAttempts - (pendingToken.attempts || 0)),
      };
    } catch (error) {
      logger.error('[PasswordResetService] Error getting reset status', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }
}

module.exports = PasswordResetService;
