/**
 * routes/loans.js
 *
 * Loan management API routes.
 *
 * Public routes:
 * - POST /api/loans - Create loan application
 * - GET /api/loans - List user's loans
 * - GET /api/loans/:loanId - Get loan details
 * - GET /api/loans/:loanId/schedule - Get repayment schedule
 * - GET /api/loans/:loanId/summary - Get loan summary
 * - POST /api/loans/:loanId/repayment - Record repayment
 *
 * Admin routes (require admin role):
 * - POST /api/loans/:loanId/approve - Approve loan
 * - POST /api/loans/:loanId/reject - Reject loan
 * - POST /api/loans/:loanId/disburse - Disburse loan
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { handleValidation } = require('../utils/validators');
const auth = require('../middleware/auth');
const loanController = require('../controllers/loanController');

/**
 * All routes require authentication
 */
router.use(auth.verifyToken);

/**
 * POST /api/loans
 * Create a new loan application
 *
 * Body: {
 *   amount: number (required),
 *   duration: number (months, required),
 *   interestRate: number (optional),
 *   purpose: string (optional),
 *   description: string (optional)
 * }
 */
router.post(
  '/',
  [
    body('amount').isNumeric().custom((val) => val > 0).withMessage('amount must be positive'),
    body('duration')
      .isInt({ min: 1, max: 360 })
      .withMessage('duration must be between 1 and 360 months'),
    body('interestRate').optional().isNumeric().withMessage('interestRate must be numeric'),
    body('purpose').optional().isString().trim(),
    body('description').optional().isString().trim(),
  ],
  handleValidation,
  loanController.createLoanApplication
);

/**
 * GET /api/loans
 * List user's loans (or all if admin)
 *
 * Query: ?page=1&limit=20&status=active&sortBy=createdAt
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('status').optional().isString(),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  handleValidation,
  loanController.listLoans
);

/**
 * GET /api/loans/:loanId/summary
 * Get loan summary (must come before :loanId routes for proper matching)
 */
router.get('/:loanId/summary', loanController.getLoanSummary);

/**
 * GET /api/loans/:loanId/schedule
 * Get repayment schedule for a loan
 *
 * Query: ?page=1&limit=50&status=pending
 */
router.get(
  '/:loanId/schedule',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('status').optional().isString(),
  ],
  handleValidation,
  loanController.getRepaymentSchedule
);

/**
 * GET /api/loans/:loanId
 * Get loan details
 */
router.get('/:loanId', loanController.getLoanDetail);

/**
 * POST /api/loans/:loanId/approve
 * Approve a loan (admin only)
 *
 * Body: {
 *   notes: string (optional)
 * }
 */
router.post(
  '/:loanId/approve',
  [
    param('loanId').isMongoId().withMessage('Invalid loan ID'),
    body('notes').optional().isString().trim(),
  ],
  handleValidation,
  loanController.approveLoan
);

/**
 * POST /api/loans/:loanId/reject
 * Reject a loan (admin only)
 *
 * Body: {
 *   reason: string (required)
 * }
 */
router.post(
  '/:loanId/reject',
  [
    param('loanId').isMongoId().withMessage('Invalid loan ID'),
    body('reason').notEmpty().isString().trim().withMessage('reason is required'),
  ],
  handleValidation,
  loanController.rejectLoan
);

/**
 * POST /api/loans/:loanId/disburse
 * Disburse a loan (admin only)
 *
 * Body: {
 *   notes: string (optional)
 * }
 */
router.post(
  '/:loanId/disburse',
  [
    param('loanId').isMongoId().withMessage('Invalid loan ID'),
    body('notes').optional().isString().trim(),
  ],
  handleValidation,
  loanController.disburseLoan
);

/**
 * POST /api/loans/:loanId/repayment
 * Record a repayment for a loan
 *
 * Body: {
 *   amount: number (required),
 *   method: string (optional),
 *   reference: string (optional)
 * }
 */
router.post(
  '/:loanId/repayment',
  [
    param('loanId').isMongoId().withMessage('Invalid loan ID'),
    body('amount').isNumeric().custom((val) => val > 0).withMessage('amount must be positive'),
    body('method').optional().isString().trim(),
    body('reference').optional().isString().trim(),
  ],
  handleValidation,
  loanController.recordRepayment
);

module.exports = router;
