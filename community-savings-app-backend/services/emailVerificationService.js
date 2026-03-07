/**
 * Email Verification Service
 * Handles generation, verification, and resend of email verification tokens
 * Uses SHA256 hashing for token storage (never stores raw tokens)
 * Enforces single-use and expiration constraints
 */

const crypto = require('crypto');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Hash token using SHA256 (one-way function for security)
const HASH_TOKEN = (token) => crypto.createHash('sha256').update(token).digest('hex');

class EmailVerificationService {
  constructor(config = {}) {
    this.tokenTTL = config.tokenTTL || 24 * 60 * 60 * 1000; // 24 hours default
    this.resendThrottleTime = config.resendThrottleTime || 5 * 60 * 1000; // 5 minutes
    this.maxResendAttempts = config.maxResendAttempts || 5; // Max 5 resends
    this.emailService = config.emailService || null;
  }

  /**
   * Generate verification token and send email
   * Enforces resend throttling to prevent spam
   * @param {Object} user - User document with _id, email, name
   * @param {boolean} isResend - Whether this is a resend attempt
   * @returns {string} - Plain token (send to user, never store this)
   */
  async generateTokenAndSend(user, isResend = false) {
    try {
      // Check if user already verified
      if (user.emailVerified) {
        logger.warn('[EmailVerificationService] Token requested for already verified email', {
          userId: user._id,
          email: user.email,
        });
        throw new Error('Email already verified');
      }

      // Check throttling for resend attempts
      if (isResend) {
        const recentToken = await EmailVerificationToken.findOne({
          user: user._id,
          createdAt: { $gte: new Date(Date.now() - this.resendThrottleTime) },
        });

        if (recentToken) {
          const waitTime = Math.ceil(
            (this.resendThrottleTime - (Date.now() - recentToken.createdAt)) / 1000
          );
          logger.warn('[EmailVerificationService] Resend throttled', {
            userId: user._id,
            waitSeconds: waitTime,
          });
          throw new Error(`Too many resend attempts. Please wait ${waitTime} seconds.`);
        }

        // Check total resend count
        const resendCount = await EmailVerificationToken.countDocuments({
          user: user._id,
          createdAt: { $gte: new Date(Date.now() - this.tokenTTL * 5) }, // Within 5 TTLs
        });

        if (resendCount >= this.maxResendAttempts) {
          logger.error('[EmailVerificationService] Max resend attempts exceeded', {
            userId: user._id,
            resendCount,
          });
          throw new Error('Maximum resend attempts exceeded. Contact support.');
        }
      }

      // Generate cryptographically secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = HASH_TOKEN(token);
      const expiresAt = new Date(Date.now() + this.tokenTTL);

      // Store hashed token in database (never raw token)
      const record = await EmailVerificationToken.create({
        user: user._id,
        tokenHash, // Store hash, not token
        expiresAt,
        isResend,
        ipAddress: null, // Can be set by controller if needed
        userAgent: null, // Can be set by controller if needed
      });

      logger.info('[EmailVerificationService] Email verification token generated', {
        userId: user._id,
        tokenId: record._id,
        expiresAt,
      });

      // Send verification email with token
      if (this.emailService) {
        await this.emailService.sendVerificationEmail(user.email, {
          userId: user._id,
          name: user.name || user.email.split('@')[0],
          token, // Send unhashed token in URL
          frontendVerifyUrl: `${process.env.FRONTEND_URL}/verify-email?token=${token}&id=${user._id}`,
        });

        logger.info('[EmailVerificationService] Verification email sent', {
          userId: user._id,
          email: user.email,
        });
      }

      // Return plain token to be sent to user (via email)
      return token;
    } catch (error) {
      logger.error('[EmailVerificationService] Error generating verification token', {
        error: error.message,
        userId: user._id,
      });
      throw error;
    }
  }

  /**
   * Verify token and mark user email as verified
   * Enforces single-use and expiration constraints
   * @param {string} userId - User ID
   * @param {string} token - Plain token from url
   * @returns {Object} - { success, user, message }
   */
  async verifyToken(userId, token) {
    try {
      if (!userId || !token) {
        throw new Error('User ID and token are required');
      }

      // Hash the token for lookup
      const tokenHash = HASH_TOKEN(token);

      // Find token record
      const tokenRecord = await EmailVerificationToken.findOne({
        user: userId,
        tokenHash,
        used: false, // Must not be used yet
      });

      if (!tokenRecord) {
        logger.warn('[EmailVerificationService] Invalid token provided', {
          userId,
        });
        throw new Error('Invalid verification token. Please request a new one.');
      }

      // Check expiration
      if (tokenRecord.expiresAt < new Date()) {
        logger.warn('[EmailVerificationService] Token expired', {
          userId,
          expiryTime: tokenRecord.expiresAt,
        });
        throw new Error('Verification token has expired. Please request a new one.');
      }

      // Mark token as used (single-use enforcement)
      tokenRecord.used = true;
      tokenRecord.verifiedAt = new Date();
      await tokenRecord.save();

      logger.info('[EmailVerificationService] Token marked as used', {
        userId,
        tokenId: tokenRecord._id,
      });

      // Update user's emailVerified flag
      const user = await User.findByIdAndUpdate(
        userId,
        {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      logger.info('[EmailVerificationService] Email verified successfully', {
        userId,
        email: user.email,
      });

      return {
        success: true,
        user,
        message: 'Email verified successfully',
      };
    } catch (error) {
      logger.error('[EmailVerificationService] Error verifying token', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Resend verification email (with throttling)
   * @param {string} userId - User ID
   * @returns {string} - New token (same behavior as generateTokenAndSend)
   */
  async resendVerificationEmail(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      logger.info('[EmailVerificationService] Resend verification email requested', {
        userId,
        email: user.email,
      });

      return await this.generateTokenAndSend(user, true); // true = isResend
    } catch (error) {
      logger.error('[EmailVerificationService] Error resending verification email', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if email is verified
   * @param {string} userId - User ID
   * @returns {boolean} - True if verified
   */
  async isEmailVerified(userId) {
    try {
      const user = await User.findById(userId, 'emailVerified');
      return user && user.emailVerified === true;
    } catch (error) {
      logger.error('[EmailVerificationService] Error checking email verification status', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Clean up expired tokens (useful for scheduled jobs)
   * @returns {number} - Number of deleted tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await EmailVerificationToken.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      logger.info('[EmailVerificationService] Expired tokens cleaned up', {
        deletedCount: result.deletedCount,
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('[EmailVerificationService] Error cleaning up expired tokens', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get verification status for user
   * @param {string} userId - User ID
   * @returns {Object} - { verified, verifiedAt, pendingToken }
   */
  async getVerificationStatus(userId) {
    try {
      const user = await User.findById(userId, 'emailVerified emailVerifiedAt');
      const pendingToken = await EmailVerificationToken.findOne(
        { user: userId, used: false },
        { expiresAt: 1 }
      );

      return {
        verified: user && user.emailVerified,
        verifiedAt: user && user.emailVerifiedAt,
        pendingToken: !!pendingToken,
        expiresAt: pendingToken && pendingToken.expiresAt,
      };
    } catch (error) {
      logger.error('[EmailVerificationService] Error getting verification status', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }
}

module.exports = EmailVerificationService;
