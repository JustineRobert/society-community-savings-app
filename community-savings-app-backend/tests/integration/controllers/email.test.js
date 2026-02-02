// tests/integration/controllers/email.test.js
// ============================================================================
// Email Controller Integration Tests
// Tests email verification and password reset flows end-to-end
// ============================================================================

const request = require('supertest');
const express = require('express');
const User = require('../../../models/User');
const EmailAudit = require('../../../models/EmailAudit');
const { connectDB, disconnectDB, clearDatabase } = require('../../helpers/db');
const { createTestUser } = require('../../helpers/auth');
const emailController = require('../../../controllers/emailController');
const crypto = require('crypto');

// Mock email service
jest.mock('../../../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
}));

const app = express();
app.use(express.json());

// Mock auth middleware for testing
app.use((req, res, next) => {
  if (req.headers.authorization) {
    req.user = {
      id: req.headers['x-user-id'] || '507f1f77bcf86cd799439011',
      email: req.headers['x-user-email'] || 'test@example.com',
      _id: req.headers['x-user-id'] || '507f1f77bcf86cd799439011',
    };
  }
  next();
});

app.post('/send-verification', emailController.sendVerificationEmailRequest);
app.post('/verify', emailController.verifyEmail);
app.post('/request-password-reset', emailController.requestPasswordReset);
app.post('/reset-password', emailController.resetPassword);
app.post('/change-password', (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  return emailController.changePassword(req, res, next);
});

describe('Email Controller Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('Email Verification Flow', () => {
    test('should send verification email to new user', async () => {
      const user = await createTestUser({ isVerified: false });

      const res = await request(app)
        .post('/send-verification')
        .send({ email: user.email })
        .expect(200);

      expect(res.body.message).toContain('sent successfully');

      // Verify token was generated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.verificationToken).toBeDefined();
      expect(updatedUser.verificationTokenExpires).toBeDefined();
    });

    test('should verify email with valid token', async () => {
      const user = await createTestUser();
      const token = user.generateVerificationToken();
      await user.save();

      const res = await request(app)
        .post('/verify')
        .send({ token })
        .expect(200);

      expect(res.body.user.isVerified).toBe(true);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.verificationToken).toBeNull();
    });

    test('should reject invalid verification token', async () => {
      const res = await request(app)
        .post('/verify')
        .send({ token: 'invalid-token-string' })
        .expect(400);

      expect(res.body.message).toContain('Invalid or expired');
    });

    test('should reject expired verification token', async () => {
      const user = await createTestUser();
      const token = user.generateVerificationToken();
      user.verificationTokenExpires = new Date(Date.now() - 1000); // 1 second ago
      await user.save();

      const res = await request(app)
        .post('/verify')
        .send({ token })
        .expect(400);

      expect(res.body.message).toContain('Invalid or expired');
    });

    test('should log audit event for verification', async () => {
      const user = await createTestUser();
      const token = user.generateVerificationToken();
      await user.save();

      await request(app)
        .post('/verify')
        .send({ token })
        .expect(200);

      const audit = await EmailAudit.findOne({ event: 'verify_email' });
      expect(audit).toBeDefined();
      expect(audit.status).toBe('success');
      expect(audit.email).toBe(user.email);
    });
  });

  describe('Password Reset Flow', () => {
    test('should send password reset email', async () => {
      const user = await createTestUser();

      const res = await request(app)
        .post('/request-password-reset')
        .send({ email: user.email })
        .expect(200);

      expect(res.body.message).toContain('sent to your email');

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.resetPasswordToken).toBeDefined();
      expect(updatedUser.resetPasswordExpires).toBeDefined();
    });

    test('should reset password with valid token', async () => {
      const user = await createTestUser();
      const token = user.generateResetToken();
      await user.save();

      const newPassword = 'NewPassword456!';

      const res = await request(app)
        .post('/reset-password')
        .send({
          token,
          password: newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      expect(res.body.message).toContain('successfully');

      const updatedUser = await User.findById(user._id).select('+password');
      const isMatch = await updatedUser.matchPassword(newPassword);
      expect(isMatch).toBe(true);
    });

    test('should reject mismatched passwords', async () => {
      const user = await createTestUser();
      const token = user.generateResetToken();
      await user.save();

      const res = await request(app)
        .post('/reset-password')
        .send({
          token,
          password: 'NewPassword456!',
          confirmPassword: 'Different456!',
        })
        .expect(400);

      expect(res.body.message).toContain('do not match');
    });

    test('should reject weak passwords', async () => {
      const user = await createTestUser();
      const token = user.generateResetToken();
      await user.save();

      const res = await request(app)
        .post('/reset-password')
        .send({
          token,
          password: 'weak',
          confirmPassword: 'weak',
        })
        .expect(400);

      expect(res.body.message).toContain('8 characters');
    });
  });

  describe('Rate Limiting', () => {
    test('should rate limit verification email requests', async () => {
      const email = 'test@example.com';

      // Make multiple requests quickly
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/send-verification')
          .send({ email });

        if (i < 3) {
          expect(res.status).toBeLessThan(429);
        } else {
          expect(res.status).toBe(429);
        }
      }
    });
  });

  describe('Password Change (Authenticated)', () => {
    test('should change password for authenticated user', async () => {
      const user = await createTestUser();
      const currentPassword = 'TestPassword123!';
      const newPassword = 'NewPassword456!';

      const res = await request(app)
        .post('/change-password')
        .set('Authorization', 'Bearer test')
        .set('x-user-id', user._id.toString())
        .set('x-user-email', user.email)
        .send({
          currentPassword,
          newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      const updatedUser = await User.findById(user._id).select('+password');
      const isMatch = await updatedUser.matchPassword(newPassword);
      expect(isMatch).toBe(true);
    });

    test('should reject incorrect current password', async () => {
      const user = await createTestUser();

      const res = await request(app)
        .post('/change-password')
        .set('Authorization', 'Bearer test')
        .set('x-user-id', user._id.toString())
        .set('x-user-email', user.email)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
          confirmPassword: 'NewPassword456!',
        })
        .expect(401);

      expect(res.body.message).toContain('incorrect');
    });
  });
});
