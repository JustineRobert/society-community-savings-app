
// routes/loans.js

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

const { body, param, query } = require('express-validator');
const { handleValidation } = require('../utils/validators');

const {
  checkEligibility,
  requestLoan,
  applyForLoan,
  approveLoan,
  rejectLoan,
  disburseLoan,
  repayLoan,
  getLoanStatus,
  getUserLoans,
  getGroupLoans,
  getLoanSchedule,
  updateLoansInBatch,
  getGroupLoanStatistics,
} = require('../controllers/loanController');

const { verifyToken, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/loans/eligibility/:groupId
 * @desc    Check loan eligibility for a group
 * @access  Private (Authenticated Users)
 */
router.get(
  '/eligibility/:groupId',
  verifyToken,
  [param('groupId').isString().trim().notEmpty()],
  handleValidation,
  asyncHandler(checkEligibility)
);

/**
 * @route   POST /api/loans/request
 * @desc    Submit a loan request
 * @access  Private (Authenticated Users)
 * @body    { groupId: string, amount: number, reason?: string, repaymentTermMonths?: number, idempotencyKey?: string }
 */
router.post(
  '/request',
  verifyToken,
  [
    body('groupId').isString().trim().notEmpty().withMessage('Group ID is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('reason').optional().isString().trim().isLength({ max: 500 }),
    body('repaymentTermMonths').optional().isInt({ min: 1, max: 60 }),
    body('idempotencyKey').optional().isString().trim(),
  ],
  handleValidation,
  asyncHandler(requestLoan)
);

/**
 * @route   POST /api/loans
 * @desc    Alternative endpoint to submit a loan request
 * @access  Private (Authenticated Users)
 * @body    { groupId: string, amount: number, reason?: string, termMonths?: number }
 */
router.post(
  '/',
  verifyToken,
  [
    body('groupId').isString().trim().notEmpty(),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be > 0'),
    body('reason').optional().isString().trim().isLength({ max: 2000 }),
    body('termMonths').optional().isInt({ min: 1, max: 360 }).withMessage('termMonths must be 1-360'),
  ],
  handleValidation,
  asyncHandler(applyForLoan)
);

/**
 * @route   GET /api/loans/:loanId
 * @desc    Retrieve loan details and status
 * @access  Private (Loan owner or Admin)
 */
router.get(
  '/:loanId',
  verifyToken,
  [param('loanId').isString().trim().notEmpty()],
  handleValidation,
  asyncHandler(getLoanStatus)
);

/**
 * @route   GET /api/loans/:loanId/schedule
 * @desc    Retrieve loan repayment schedule and progress
 * @access  Private (Loan owner or Admin)
 */
router.get(
  '/:loanId/schedule',
  verifyToken,
  [param('loanId').isString().trim().notEmpty()],
  handleValidation,
  asyncHandler(getLoanSchedule)
);

/**
 * @route   GET /api/loans/user/all
 * @desc    Retrieve all loans for authenticated user (paginated)
 * @access  Private (Authenticated Users)
 * @query   ?page=1&limit=50&status=pending|approved|rejected|disbursed|repaid
 */
router.get(
  '/user/all',
  verifyToken,
  [
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'disbursed', 'repaid']),
  ],
  handleValidation,
  asyncHandler(getUserLoans)
);

/**
 * @route   PATCH /api/loans/:loanId/approve
 * @desc    Approve a pending loan
 * @access  Private (Admin/Group Admin only)
 * @body    { interestRate: number, repaymentPeriodMonths: number, notes?: string }
 */
router.patch(
  '/:loanId/approve',
  verifyToken,
  requireRole('admin', 'group_admin'),
  [
    param('loanId').isString().trim().notEmpty(),
    body('interestRate').optional().isFloat({ min: 0, max: 100 }),
    body('repaymentPeriodMonths').optional().isInt({ min: 1, max: 60 }),
    body('notes').optional().isString().trim(),
  ],
  handleValidation,
  asyncHandler(approveLoan)
);

/**
 * @route   PATCH /api/loans/:loanId/reject
 * @desc    Reject a pending loan
 * @access  Private (Admin/Group Admin only)
 * @body    { reason: string }
 */
router.patch(
  '/:loanId/reject',
  verifyToken,
  requireRole('admin', 'group_admin'),
  [
    param('loanId').isString().trim().notEmpty(),
    body('reason').isString().trim().notEmpty().withMessage('Rejection reason is required'),
  ],
  handleValidation,
  asyncHandler(rejectLoan)
);

/**
 * @route   PATCH /api/loans/:loanId/disburse
 * @desc    Disburse an approved loan
 * @access  Private (Admin/Group Admin only)
 * @body    { paymentMethod?: string, notes?: string }
 */
router.patch(
  '/:loanId/disburse',
  verifyToken,
  requireRole('admin', 'group_admin'),
  [
    param('loanId').isString().trim().notEmpty(),
    body('paymentMethod').optional().isString().trim(),
    body('notes').optional().isString().trim(),
  ],
  handleValidation,
  asyncHandler(disburseLoan)
);

/**
 * @route   POST /api/loans/:loanId/repay
 * @desc    Record a loan repayment
 * @access  Private (Admin or Loan owner)
 * @body    { amount: number, paymentMethod?: string, notes?: string }
 */
router.post(
  '/:loanId/repay',
  verifyToken,
  [
    param('loanId').isString().trim().notEmpty(),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('paymentMethod').optional().isString().trim(),
    body('notes').optional().isString().trim(),
  ],
  handleValidation,
  asyncHandler(repayLoan)
);

/**
 * @route   GET /api/loans/group/:groupId
 * @desc    Retrieve all loans within a specific group (paginated, admin only)
 * @access  Private (Admin/Group Admin only)
 * @query   ?page=1&limit=50&status=pending|approved|rejected
 */
router.get(
  '/group/:groupId',
  verifyToken,
  requireRole('admin', 'group_admin'),
  [
    param('groupId').isString().trim().notEmpty(),
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'disbursed', 'repaid']),
  ],
  handleValidation,
  asyncHandler(getGroupLoans)
);

/**
 * @route   GET /api/loans/group/:groupId/statistics
 * @desc    Get loan statistics for a group
 * @access  Private (Admin/Group Admin only)
 */
router.get(
  '/group/:groupId/statistics',
  verifyToken,
  requireRole('admin', 'group_admin'),
  [param('groupId').isString().trim().notEmpty()],
  handleValidation,
  asyncHandler(getGroupLoanStatistics)
);

/**
 * @route   PATCH /api/loans/batch
 * @desc    Batch update loan statuses
 * @access  Private (Admin only)
 * @body    { loanIds: string[], newStatus: string, reason?: string }
 */
router.patch(
  '/batch',
  verifyToken,
  requireRole('admin'),
  [
    body('loanIds').isArray({ min: 1 }).withMessage('Must provide at least one loan ID'),
    body('newStatus').isIn(['approved', 'rejected', 'cancelled']),
    body('reason').optional().isString().trim(),
  ],
  handleValidation,
  asyncHandler(updateLoansInBatch)
);

module.exports = router;
