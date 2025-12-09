// routes/loans.js

const express = require('express');
const router = express.Router();

const {
  requestLoan,
  getUserLoans,
  getGroupLoans,
  updateLoanStatus,
} = require('../controllers/loanController');

const { verifyToken } = require('../middleware/auth'); // Adjusted for clarity and consistency

/**
 * @route   POST /api/loans
 * @desc    Submit a loan request
 * @access  Private (Authenticated Users)
 */
router.post('/', verifyToken, requestLoan);

/**
 * @route   GET /api/loans/user
 * @desc    Retrieve all loans associated with the current user
 * @access  Private (Authenticated Users)
 */
router.get('/user', verifyToken, getUserLoans);

/**
 * @route   GET /api/loans/group/:groupId
 * @desc    Retrieve all loans within a specific group
 * @access  Private (Authenticated Users)
 */
router.get('/group/:groupId', verifyToken, getGroupLoans);

/**
 * @route   PATCH /api/loans/:loanId/status
 * @desc    Update the status of a specific loan (e.g., approve/reject)
 * @access  Private (Requires Elevated Role - Admin/Group Admin)
 */
router.patch('/:loanId/status', verifyToken, updateLoanStatus);

module.exports = router;
