// routes/payments.js
// ============================================================================
// Payment Routes - Mobile Money Integration
// Handles payment initiation, status checks, and refunds
// ============================================================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Middleware: Validate payment input
 */
const validatePaymentInput = [
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format. Use E.164 format (e.g., +237123456789)'),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 100, max: 500000 })
    .withMessage('Amount must be between 100 and 500,000'),

  body('currency')
    .optional()
    .isIn(['XAF', 'EUR', 'USD', 'NGN', 'GHS', 'KES', 'ZAR'])
    .withMessage('Unsupported currency'),

  body('provider')
    .notEmpty()
    .withMessage('Provider is required')
    .isIn(['MTN_MOMO', 'AIRTEL_MONEY'])
    .withMessage('Provider must be MTN_MOMO or AIRTEL_MONEY'),

  body('groupId')
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid group ID format'),

  body('contributionId')
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid contribution ID format'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters'),
];

/**
 * Middleware: Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors', {
      errors: errors.array(),
      userId: req.user?._id,
      path: req.path,
    });
    return res.status(422).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * POST /api/payments/initiate
 * Initiate a new mobile money payment
 */
router.post(
  '/initiate',
  verifyToken,
  validatePaymentInput,
  handleValidationErrors,
  paymentController.initiatePayment
);

/**
 * GET /api/payments/:transactionId/status
 * Check payment status
 */
router.get('/status/:transactionId', verifyToken, paymentController.checkPaymentStatus);

/**
 * POST /api/payments/:transactionId/refund
 * Request refund for a payment
 */
router.post(
  '/:transactionId/refund',
  verifyToken,
  body('refundAmount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be greater than 0'),

  body('refundReason')
    .notEmpty()
    .withMessage('Refund reason is required')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Refund reason must be between 10 and 500 characters'),

  handleValidationErrors,
  paymentController.requestRefund
);

/**
 * GET /api/payments
 * Get payment history with filtering
 */
router.get(
  '/',
  verifyToken,
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']),
  query('provider').optional().isIn(['MTN_MOMO', 'AIRTEL_MONEY', 'STRIPE', 'PAYPAL']),
  query('skip').optional().isInt({ min: 0 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
  paymentController.getPaymentHistory
);

/**
 * GET /api/payments/:transactionId
 * Get payment details
 */
router.get('/:transactionId', verifyToken, paymentController.getPaymentDetails);

module.exports = router;
