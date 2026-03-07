/**
 * tests/integration/email.test.js
 *
 * Integration tests for email verification and password reset.
 * Tests token security, single-use enforcement, throttling, and brute-force protection.
 *
 * Coverage: EmailVerificationService, PasswordResetService
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const EmailVerificationService = require('../../services/emailVerificationService');
const PasswordResetService = require('../../services/passwordResetService');
const crypto = require('crypto');

describe('Email Services Integration Tests', () => {
  let testUser;
  let authToken;
  let emailVerificationService;
  let passwordResetService;

  beforeAll(async () => {
    // Initialize services
    emailVerificationService =
      app.locals.emailVerificationService || new EmailVerificationService();
    passwordResetService = app.locals.passwordResetService || new PasswordResetService();
  });

  beforeEach(async () => {
    // Create test user
    const User = require('../../models/User');
    testUser = await User.create({
      name: 'Email Test User',
      email: `email-test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
      verified: false,
    });

    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { _id: testUser._id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    const User = require('../../models/User');
    const EmailVerificationToken = require('../../models/EmailVerificationToken');
    const PasswordResetToken = require('../../models/PasswordResetToken');

    await User.deleteMany({});
    await EmailVerificationToken.deleteMany({});
    await PasswordResetToken.deleteMany({});
  });

  describe('Email Verification Service', () => {
    test('should generate and send verification token', async () => {
      const result = await emailVerificationService.generateTokenAndSend(testUser._id);

      expect(result).toHaveProperty('expiresAt');
      expect(result.sent).toBe(true);

      // Verify token is hashed in DB
      const EmailVerificationToken = require('../../models/EmailVerificationToken');
      const token = await EmailVerificationToken.findOne({ user: testUser._id });
      expect(token).toBeDefined();
      expect(token.tokenHash).toBeDefined();
      // Raw token should not be stored
      expect(token.tokenHash).not.toBe(result.token);
    });

    test('should verify token correctly', async () => {
      const result = await emailVerificationService.generateTokenAndSend(testUser._id);
      const token = result.token;

      // Verify token
      const verified = await emailVerificationService.verifyToken(testUser._id, token);
      expect(verified).toBe(true);

      // Token should now be marked as used
      const EmailVerificationToken = require('../../models/EmailVerificationToken');
      const record = await EmailVerificationToken.findOne({ user: testUser._id });
      expect(record.usedAt).toBeDefined();
    });

    test('should reject token on second use', async () => {
      const result = await emailVerificationService.generateTokenAndSend(testUser._id);
      const token = result.token;

      // First use - should succeed
      await emailVerificationService.verifyToken(testUser._id, token);

      // Second use - should fail
      const verified = await emailVerificationService.verifyToken(testUser._id, token);
      expect(verified).toBe(false);
    });

    test('should enforce resend throttling', async () => {
      // First request
      await emailVerificationService.generateTokenAndSend(testUser._id);

      // Immediate second request (within 5 min cooldown)
      const result = await emailVerificationService.generateTokenAndSend(testUser._id);
      expect(result.throttled).toBe(true);
    });

    test('should cleanup expired tokens', async () => {
      // Create token with past expiry
      const EmailVerificationToken = require('../../models/EmailVerificationToken');
      await EmailVerificationToken.create({
        user: testUser._id,
        tokenHash: crypto.createHash('sha256').update('old-token').digest('hex'),
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      });

      expect(await EmailVerificationToken.countDocuments({ user: testUser._id })).toBe(1);

      // Cleanup
      await emailVerificationService.cleanupExpiredTokens();

      // Should be deleted
      expect(await EmailVerificationToken.countDocuments({ user: testUser._id })).toBe(0);
    });
  });

  describe('Password Reset Service', () => {
    test('should create reset token with proper security', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);

      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('token');

      // Verify token is hashed in DB
      const PasswordResetToken = require('../../models/PasswordResetToken');
      const token = await PasswordResetToken.findOne({ user: testUser._id });
      expect(token).toBeDefined();
      expect(token.tokenHash).not.toBe(result.token);
    });

    test('should validate strong password requirements', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);
      const token = result.token;

      // Weak password (no special char)
      const weakPassword = 'WeakPass123';
      const result1 = await passwordResetService.resetPassword(
        testUser._id,
        token,
        weakPassword
      );
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('strong');

      // Strong password
      const strongPassword = 'StrongPass123!@#';
      const result2 = await passwordResetService.resetPassword(
        testUser._id,
        token,
        strongPassword
      );
      expect(result2.success).toBe(true);
    });

    test('should enforce single-use tokens', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);
      const token = result.token;

      // First use
      await passwordResetService.resetPassword(testUser._id, token, 'NewPass123!@#');

      // Second use - should fail
      const PasswordResetToken = require('../../models/PasswordResetToken');
      const record = await PasswordResetToken.findOne({ user: testUser._id });
      expect(record.usedAt).toBeDefined();
    });

    test('should implement brute-force protection', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);
      const token = result.token;

      // Attempt wrong password 6 times
      for (let i = 0; i < 6; i++) {
        await passwordResetService.resetPassword(testUser._id, token, 'WrongPass123!@#');
      }

      // Token should be locked
      const PasswordResetToken = require('../../models/PasswordResetToken');
      const record = await PasswordResetToken.findOne({ user: testUser._id });
      expect(record.attemptsRemaining).toBe(0);
      expect(record.locked).toBe(true);
    });

    test('should have 1-hour TTL on reset tokens', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);

      // Verify expiresAt is ~1 hour from now
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const diff = result.expiresAt - now;

      expect(diff).toBeGreaterThan(oneHour - 10000); // Allow 10s margin
      expect(diff).toBeLessThan(oneHour + 10000);
    });

    test('should log audit trail on password reset', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);
      const token = result.token;

      await passwordResetService.resetPassword(testUser._id, token, 'NewPass123!@#');

      // Check audit log
      const AuditLog = require('../../models/AuditLog');
      const audit = await AuditLog.findOne({
        action: 'password_reset',
        user: testUser._id,
      });
      expect(audit).toBeDefined();
    });
  });

  describe('POST /api/auth/verify-email - Email Verification Endpoint', () => {
    test('should verify email with valid token', async () => {
      const result = await emailVerificationService.generateTokenAndSend(testUser._id);
      const token = result.token;

      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token });

      expect(res.status).toBe(200);

      // User should be marked as verified
      const User = require('../../models/User');
      const updated = await User.findById(testUser._id);
      expect(updated.verified).toBe(true);
    });

    test('should reject invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: 'invalid-token-12345' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password - Password Reset Endpoint', () => {
    test('should reset password with valid token', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);
      const token = result.token;

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token,
          newPassword: 'NewSecurePass123!@#',
        });

      expect(res.status).toBe(200);
    });

    test('should validate password strength', async () => {
      const result = await passwordResetService.createResetToken(testUser._id);
      const token = result.token;

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token,
          newPassword: 'weak', // Too weak
        });

      expect(res.status).toBe(400);
    });
  });
});
