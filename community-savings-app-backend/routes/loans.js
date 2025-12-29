
// routes/loans.js

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

const { body, param, query } = require('express-validator');
const { handleValidation } = require('../utils/validators');

const {
  requestLoan,
  getUserLoans,
  getGroupLoans,
  updateLoanStatus,
} = require('../controllers/loanController');

const { verifyToken, requireRole } = require('../middleware/auth');

/**
 * @route   POST /api/loans
 * @desc    Submit a loan request
 * @access  Private (Authenticated Users)
 * @body    { amount: number, groupId: string, reason?: string, termMonths?: number }
 */
router.post(
  '/',
  verifyToken,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be > 0'),
    body('groupId').isString().trim().notEmpty(),
    body('reason').optional().isString().trim().isLength({ max: 2000 }),
    body('termMonths').optional().isInt({ min: 1, max: 360 }).withMessage('termMonths must be 1-360'),
  ],
  handleValidation,
  asyncHandler(requestLoan)
);

/**
 * @route   GET /api/loans/user
 * @desc    Retrieve all loans associated with the current user (paginated)
 * @access  Private (Authenticated Users)
 * @query   ?page=1&limit=50&status=pending|approved|rejected
 */
router.get(
  '/user',
  verifyToken,
  [
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
  ],
  handleValidation,
  asyncHandler(getUserLoans)
);

/**
 * @route   GET /api/loans/group/:groupId
 * @desc    Retrieve all loans within a specific group (paginated)
 * @access  Private (Authenticated Users)
 */
router.get(
  '/group/:groupId',
  verifyToken,
  [
    param('groupId').isString().trim().notEmpty(),
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 200 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
  ],
  handleValidation,
  asyncHandler(getGroupLoans)
);

/**
 * @route   PATCH /api/loans/:loanId/status
 * @desc    Update the status of a specific loan (approve/reject)
 * @access  Private (Requires Elevated Role - Admin/Group Admin)
 * @body    { status: 'approved' | 'rejected', note?: string }
 */
router.patch(
  '/:loanId/status',
  verifyToken,
  requireRole('admin', 'group_admin'),
  [
    param('loanId').isString().trim().notEmpty(),
    body('status').isIn(['approved', 'rejected']).withMessage('status must be approved|rejected'),
    body('note').optional().isString().trim().isLength({ max: 2000 }),
  ],
  handleValidation,
  asyncHandler(updateLoanStatus)
);

module.exports = router;
