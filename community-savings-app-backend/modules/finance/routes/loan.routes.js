// backend/modules/finance/routes/loan.routes.js
'use strict';

const express = require('express');
const router = express.Router();

// Controllers
const LoanController = require('../controllers/LoanController');

// Validation Middleware
const validate = require('../middleware/validateLoan');

// Auth & RBAC Middleware
const auth = require('../../auth/middleware/authMiddleware');
const permit = require('../../auth/middleware/permissionMiddleware');

/**
 * =========================================================
 * GLOBAL SECURITY LAYER
 * =========================================================
 * Enforces authentication for all loan routes
 */
router.use(auth);

/**
 * =========================================================
 * LOAN ROUTES (PRODUCTION GRADE)
 * =========================================================
 */

/**
 * @route   POST /api/loans
 * @desc    Create Loan Application
 * @access  ADMIN, LOAN_OFFICER
 */
router.post(
  '/',
  permit('ADMIN', 'LOAN_OFFICER'),
  validate.createLoan,
  LoanController.createLoan
);

/**
 * @route   POST /api/loans/:id/approve
 * @desc    Approve Loan
 * @access  ADMIN, TREASURER
 */
router.post(
  '/:id/approve',
  permit('ADMIN', 'TREASURER'),
  LoanController.approveLoan
);

/**
 * @route   POST /api/loans/:id/disburse
 * @desc    Disburse Loan
 * @access  TREASURER
 */
router.post(
  '/:id/disburse',
  permit('TREASURER'),
  validate.disburseLoan,
  LoanController.disburseLoan
);

/**
 * @route   POST /api/loans/:id/repay
 * @desc    Repay Loan
 * @access  MEMBER, TREASURER, ADMIN
 */
router.post(
  '/:id/repay',
  permit('MEMBER', 'TREASURER', 'ADMIN'),
  validate.repayLoan,
  LoanController.repayLoan
);

/**
 * @route   GET /api/loans/:id
 * @desc    Get Loan by ID
 * @access  ADMIN, LOAN_OFFICER, TREASURER
 */
router.get(
  '/:id',
  permit('ADMIN', 'LOAN_OFFICER', 'TREASURER'),
  LoanController.getLoan
);

/**
 * @route   GET /api/loans
 * @desc    Get All Loans (paginated/filterable at controller level)
 * @access  ADMIN, LOAN_OFFICER, TREASURER
 */
router.get(
  '/',
  permit('ADMIN', 'LOAN_OFFICER', 'TREASURER'),
  LoanController.getLoans
);

module.exports = router;