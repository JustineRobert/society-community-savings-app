/**
 * Password Reset Service Unit Tests
 */

const passwordResetService = require('../../../services/passwordResetService');
const PasswordResetToken = require('../../../models/PasswordResetToken');
const User = require('../../../models/User');
const logger = require('../../../utils/logger');

jest.mock('../../../models/PasswordResetToken');
jest.mock('../../../models/User');
jest.mock('../../../utils/logger');
jest.mock('bcryptjs');

describe('Password Reset Service', () => {
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      _id: '123456789',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed_password',
    };
  });

  describe('createResetToken', () => {
    it('should create reset token and send email', async () => {
      const service = new passwordResetService.constructor();

      PasswordResetToken.create.mockResolvedValue({
        _id: 'reset_token_123',
        user: mockUser._id,
        tokenHash: 'hashed_token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const result = await service.createResetToken(mockUser);

      expect(result).toBeDefined();
      expect(PasswordResetToken.create).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const service = new passwordResetService.constructor();

      const tokenRecord = {
        user: mockUser._id,
        tokenHash: 'hashed_token',
        used: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };

      PasswordResetToken.findOne.mockResolvedValue(tokenRecord);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        password: 'new_hashed_password',
      });

      const result = await service.resetPassword(mockUser._id, 'valid_token', 'NewPassword123!@#');

      expect(result.success).toBe(true);
      expect(tokenRecord.used).toBe(true);
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should reject weak passwords', async () => {
      const service = new passwordResetService.constructor();

      await expect(service.resetPassword(mockUser._id, 'token', 'weak')).rejects.toThrow();
    });

    it('should throw error for invalid token', async () => {
      const service = new passwordResetService.constructor();

      PasswordResetToken.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword(mockUser._id, 'invalid_token', 'NewPassword123!@#')
      ).rejects.toThrow('Invalid reset token');
    });

    it('should throw error for expired token', async () => {
      const service = new passwordResetService.constructor();

      const expiredToken = {
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      PasswordResetToken.findOne.mockResolvedValue(expiredToken);

      await expect(
        service.resetPassword(mockUser._id, 'token', 'NewPassword123!@#')
      ).rejects.toThrow('expired');
    });
  });
});
