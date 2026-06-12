// community-savings-app-backend/routes/payments.js

/**
 * Payment Routes
 *
 * Comprehensive payment API endpoints supporting:
 * - Payment initiation for all methods
 * - Mobile money processing (M-Pesa, Airtel, MTN)
 * - Bank transfer processing
 * - Payment verification and status
 * - Refunds and cancellations
 * - Payment history and analytics
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { handleValidation } = require('../utils/validators');
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

/**
 * All routes require authentication
 */
router.use(auth.verifyToken);

/**
 * Initiate a new payment
 * POST /api/payments/initiate
 */
router.post(
  '/initiate',
  [
    body('groupId').isMongoId().withMessage('Valid group ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('method')
      .isIn(['mobile_money', 'bank_transfer', 'card', 'cash'])
      .withMessage('Invalid payment method'),
    body('type')
      .isIn([
        'contribution',
        'loan_repayment',
        'loan_disbursement',
        'referral_bonus',
        'withdrawal',
        'fee',
      ])
      .withMessage('Invalid payment type'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
    handleValidation,
  ],
  paymentController.initiatePayment
);

/**
 * Process mobile money payment
 * POST /api/payments/:paymentId/mobile-money
 */
router.post(
  '/:paymentId/mobile-money',
  [
    param('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('phoneNumber')
      .matches(/^(\+254|254|0)[17]\d{8}$/)
      .withMessage('Valid Kenyan phone number required'),
    body('provider')
      .optional()
      .isIn(['mpesa', 'airtel', 'mtn'])
      .withMessage('Invalid mobile money provider'),
    body('accountReference').optional().isLength({ max: 100 }),
    handleValidation,
  ],
  paymentController.processMobileMoneyPayment
);

/**
 * Process bank transfer payment
 * POST /api/payments/:paymentId/bank-transfer
 */
router.post(
  '/:paymentId/bank-transfer',
  [
    param('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('bankCode').notEmpty().withMessage('Bank code is required'),
    body('accountNumber').notEmpty().withMessage('Account number is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    body('routingNumber').optional(),
    handleValidation,
  ],
  paymentController.processBankTransfer
);

/**
 * Verify payment status
 * GET /api/payments/:paymentId
 */
router.get(
  '/:paymentId',
  [param('paymentId').isMongoId().withMessage('Valid payment ID is required'), handleValidation],
  paymentController.verifyPayment
);

/**
 * Get user payment history
 * GET /api/payments/history
 */
router.get(
  '/history',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
    query('type')
      .optional()
      .isIn([
        'contribution',
        'loan_repayment',
        'loan_disbursement',
        'referral_bonus',
        'withdrawal',
        'fee',
      ]),
    query('method').optional().isIn(['mobile_money', 'bank_transfer', 'card', 'cash']),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    handleValidation,
  ],
  paymentController.getPaymentHistory
);

/**
 * Process refund
 * POST /api/payments/:paymentId/refund
 */
router.post(
  '/:paymentId/refund',
  [
    param('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
    body('reason')
      .notEmpty()
      .withMessage('Refund reason is required')
      .isLength({ max: 500 })
      .withMessage('Reason too long'),
    handleValidation,
  ],
  paymentController.processRefund
);

/**
 * Get payment analytics
 * GET /api/payments/analytics
 */
router.get(
  '/analytics',
  [
    query('userId').optional().isMongoId().withMessage('Valid user ID required'),
    query('groupId').optional().isMongoId().withMessage('Valid group ID required'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    handleValidation,
  ],
  paymentController.getPaymentAnalytics
);

/**
 * Get payment methods and fees
 * GET /api/payments/methods
 */
router.get(
  '/methods',
  [
    query('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
    query('currency')
      .optional()
      .isIn(['KES', 'USD', 'EUR', 'TZS', 'UGX'])
      .withMessage('Unsupported currency'),
    handleValidation,
  ],
  paymentController.getPaymentMethods
);

/**
 * Get payment statistics for dashboard
 * GET /api/payments/stats
 */
router.get('/stats', paymentController.getPaymentStats);

/**
 * Create a payment intent
 * POST /api/payments/intents
 */
router.post(
  '/intents',
  [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('currency')
      .optional()
      .isIn(['KES', 'USD', 'EUR', 'TZS', 'UGX'])
      .withMessage('Unsupported currency'),
    body('description').optional().isString(),
    body('idempotencyKey').optional().isString(),
    handleValidation,
  ],
  paymentController.createPaymentIntent
);

/**
 * Get a specific payment intent
 * GET /api/payments/intents/:transactionId
 */
router.get('/intents/:transactionId', paymentController.getPaymentIntent);

/**
 * Webhook endpoint for external payment providers
 * POST /api/payments/webhooks/:provider
 */
router.post('/webhooks/:provider', paymentController.handleWebhook);

/**
 * List transactions (payment history with additional filters)
 * GET /api/payments/transactions
 */
router.get('/transactions', paymentController.listTransactions);

module.exports = router; // finished defining payment routes
