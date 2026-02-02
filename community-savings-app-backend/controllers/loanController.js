/**
 * loanController.js - ENHANCED
 * 
 * Production-grade loan management
 * Includes: eligibility, application, approval, disbursement, repayment
 * Full audit trail, proper error handling, idempotency
 */

const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
const LoanEligibility = require('../models/LoanEligibility');
const LoanAudit = require('../models/LoanAudit');
const User = require('../models/User');
const Group = require('../models/Group');
const Contribution = require('../models/Contribution');
const { asyncHandler } = require('../utils/asyncHandler');
const { assessEligibility, getEligibility } = require('../services/loanScoringService');

/**
 * Check loan eligibility
 * GET /api/loans/eligibility/:groupId
 */
exports.checkEligibility = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  // Validate inputs
  if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid group ID',
    });
  }

  // Verify group exists and user is member
  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  const isMember = group.members.includes(req.user._id);
  if (!isMember) {
    return res.status(403).json({
      success: false,
      message: 'You are not a member of this group',
    });
  }

  // Get eligibility assessment
  const eligibility = await getEligibility(req.user._id, groupId, req.user._id);

  res.json({
    success: true,
    data: eligibility,
  });
});

/**
 * Apply for loan
 * POST /api/loans/apply
 * Body: { groupId, amount, reason, idempotencyKey }
 */
exports.applyForLoan = asyncHandler(async (req, res) => {
  const { groupId, amount, reason, idempotencyKey } = req.body;

  // Input validation
  if (!groupId || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Group ID and amount are required',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid group ID',
    });
  }

  if (amount <= 0 || !Number.isInteger(amount)) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be a positive integer',
    });
  }

  // Check for duplicate application (idempotency)
  if (idempotencyKey) {
    const existing = await Loan.findOne({
      user: req.user._id,
      group: groupId,
      idempotencyKey,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Loan application already exists',
        data: existing,
        isDuplicate: true,
      });
    }
  }

  // Verify group exists
  const group = await Group.findById(groupId).populate('members');
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check membership
  const isMember = group.members.some((m) => m._id.equals(req.user._id));
  if (!isMember) {
    return res.status(403).json({
      success: false,
      message: 'You must be a member of this group to apply for a loan',
    });
  }

  // Check eligibility
  const eligibility = await getEligibility(req.user._id, groupId, req.user._id);

  if (!eligibility.isEligible) {
    await LoanAudit.logAction({
      action: 'loan_applied',
      user: req.user._id,
      group: groupId,
      actor: req.user._id,
      actorRole: req.user.role,
      description: 'Loan application rejected: ineligible',
      amount,
      metadata: {
        rejectionReason: eligibility.rejectionReason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      status: 'failed',
    });

    return res.status(403).json({
      success: false,
      message: 'You are not eligible to apply for a loan at this time',
      reason: eligibility.rejectionReason,
    });
  }

  // Check amount against max allowed
  if (amount > eligibility.maxLoanAmount) {
    return res.status(400).json({
      success: false,
      message: `Requested amount exceeds your limit. Max allowed: ${eligibility.maxLoanAmount}`,
      maxAllowed: eligibility.maxLoanAmount,
    });
  }

  // Check for existing pending/approved loans in same group
  const existingPending = await Loan.findOne({
    user: req.user._id,
    group: groupId,
    status: { $in: ['pending', 'approved', 'disbursed'] },
  });

  if (existingPending) {
    return res.status(409).json({
      success: false,
      message: 'You already have a pending or active loan in this group',
    });
  }

  // Create loan application
  const loan = new Loan({
    user: req.user._id,
    group: groupId,
    amount,
    reason: reason || null,
    status: 'pending',
    eligibilityScore: eligibility.overallScore,
    idempotencyKey,
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await loan.save({ session });

    // Audit log
    await LoanAudit.logAction({
      action: 'loan_applied',
      loan: loan._id,
      user: req.user._id,
      group: groupId,
      actor: req.user._id,
      actorRole: req.user.role,
      description: `Loan application submitted: ${amount}`,
      amount,
      metadata: {
        eligibilityScore: eligibility.overallScore,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: loan,
    });
  } catch (error) {
    await session.abortTransaction();

    await LoanAudit.logAction({
      action: 'loan_applied',
      user: req.user._id,
      group: groupId,
      actor: req.user._id,
      actorRole: req.user.role,
      description: 'Loan application failed',
      amount,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      status: 'failed',
      error: {
        message: error.message,
        code: error.code,
      },
    });

    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Approve loan (admin/group_admin only)
 * PUT /api/loans/:loanId/approve
 * Body: { interestRate, repaymentPeriodMonths, notes }
 */
exports.approveLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { interestRate = 0, repaymentPeriodMonths = 6, notes } = req.body;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'group_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can approve loans',
    });
  }

  // Validate loan exists
  const loan = await Loan.findById(loanId).populate('user', 'name email').populate('group', 'name');

  if (!loan) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found',
    });
  }

  // Check status
  if (loan.status !== 'pending') {
    return res.status(409).json({
      success: false,
      message: `Cannot approve loan with status: ${loan.status}`,
    });
  }

  // Validate inputs
  if (interestRate < 0 || interestRate > 100) {
    return res.status(400).json({
      success: false,
      message: 'Interest rate must be between 0 and 100',
    });
  }

  if (repaymentPeriodMonths < 1 || repaymentPeriodMonths > 60) {
    return res.status(400).json({
      success: false,
      message: 'Repayment period must be between 1 and 60 months',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update loan
    const oldStatus = loan.status;
    loan.status = 'approved';
    loan.approvedBy = req.user._id;
    loan.interestRate = interestRate;
    loan.repaymentPeriodMonths = repaymentPeriodMonths;
    loan.approvedAt = new Date();

    await loan.save({ session });

    // Audit log
    await LoanAudit.logAction({
      action: 'loan_approved',
      loan: loan._id,
      user: loan.user._id,
      group: loan.group._id,
      actor: req.user._id,
      actorRole: req.user.role,
      changes: {
        before: { status: oldStatus },
        after: { status: 'approved', interestRate, repaymentPeriodMonths },
      },
      description: `Loan approved: ${loan.amount}, ${interestRate}% interest, ${repaymentPeriodMonths} months`,
      amount: loan.amount,
      metadata: {
        notes,
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Loan approved successfully',
      data: loan,
    });
  } catch (error) {
    await session.abortTransaction();

    await LoanAudit.logAction({
      action: 'loan_approved',
      loan: loanId,
      actor: req.user._id,
      actorRole: req.user.role,
      status: 'failed',
      error: {
        message: error.message,
      },
    });

    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Reject loan (admin/group_admin only)
 * PUT /api/loans/:loanId/reject
 * Body: { reason }
 */
exports.rejectLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { reason } = req.body;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'group_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can reject loans',
    });
  }

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required',
    });
  }

  const loan = await Loan.findById(loanId);

  if (!loan) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found',
    });
  }

  if (loan.status !== 'pending') {
    return res.status(409).json({
      success: false,
      message: `Cannot reject loan with status: ${loan.status}`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    loan.status = 'rejected';
    loan.rejectionReason = reason;
    loan.rejectedAt = new Date();

    await loan.save({ session });

    // Audit log
    await LoanAudit.logAction({
      action: 'loan_rejected',
      loan: loan._id,
      user: loan.user,
      group: loan.group,
      actor: req.user._id,
      actorRole: req.user.role,
      description: `Loan rejected: ${reason}`,
      amount: loan.amount,
      metadata: {
        reason,
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Loan rejected',
      data: loan,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Disburse loan (admin/group_admin only)
 * PUT /api/loans/:loanId/disburse
 * Body: { paymentMethod, notes }
 */
exports.disburseLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { paymentMethod = 'bank_transfer', notes } = req.body;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'group_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can disburse loans',
    });
  }

  const loan = await Loan.findById(loanId).populate('user').populate('group');

  if (!loan) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found',
    });
  }

  if (loan.status !== 'approved') {
    return res.status(409).json({
      success: false,
      message: `Cannot disburse loan with status: ${loan.status}. Must be 'approved'.`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Generate repayment schedule
    const installmentAmount = Math.ceil(loan.amount / loan.repaymentPeriodMonths);
    const installments = [];
    const startDate = new Date();

    for (let i = 1; i <= loan.repaymentPeriodMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      installments.push({
        installmentNumber: i,
        amount: installmentAmount,
        dueDate,
        paid: false,
      });
    }

    // Create repayment schedule
    const schedule = new LoanRepaymentSchedule({
      loan: loan._id,
      installments,
      totalAmount: loan.amount,
      interestRate: loan.interestRate,
      status: 'active',
    });

    await schedule.save({ session });

    // Update loan
    loan.status = 'disbursed';
    loan.disburseDate = new Date();
    loan.repaymentSchedule = schedule._id;
    loan.disbursementMethod = paymentMethod;

    await loan.save({ session });

    // Audit log
    await LoanAudit.logAction({
      action: 'loan_disbursed',
      loan: loan._id,
      user: loan.user._id,
      group: loan.group._id,
      actor: req.user._id,
      actorRole: req.user.role,
      description: `Loan disbursed: ${loan.amount} to ${loan.user.name}`,
      amount: loan.amount,
      metadata: {
        paymentMethod,
        scheduleId: schedule._id,
        installments: installments.length,
        notes,
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Loan disbursed successfully',
      data: {
        loan,
        schedule,
      },
    });
  } catch (error) {
    await session.abortTransaction();

    await LoanAudit.logAction({
      action: 'loan_disbursed',
      loan: loanId,
      actor: req.user._id,
      actorRole: req.user.role,
      status: 'failed',
      error: {
        message: error.message,
      },
    });

    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Record loan payment
 * PUT /api/loans/:loanId/pay
 * Body: { amount, paymentMethod, notes }
 */
exports.repayLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { amount, paymentMethod = 'cash', notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid payment amount is required',
    });
  }

  const loan = await Loan.findById(loanId).populate('user').populate('group');

  if (!loan) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found',
    });
  }

  if (loan.status !== 'disbursed') {
    return res.status(409).json({
      success: false,
      message: 'Loan is not in disbursed status',
    });
  }

  // Get repayment schedule
  const schedule = await LoanRepaymentSchedule.findById(loan.repaymentSchedule);

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Repayment schedule not found',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Record payment
    const paymentRecord = await schedule.recordPayment({
      amount,
      method: paymentMethod,
      notes,
    });

    await schedule.save({ session });

    // Check if loan is fully repaid
    if (schedule.status === 'completed') {
      loan.status = 'repaid';
      loan.repaidAt = new Date();
    }

    await loan.save({ session });

    // Audit log
    await LoanAudit.logAction({
      action: 'payment_recorded',
      loan: loan._id,
      user: loan.user._id,
      group: loan.group._id,
      actor: req.user._id,
      actorRole: req.user.role,
      description: `Payment recorded: ${amount}`,
      amount,
      metadata: {
        paymentMethod,
        notes,
        totalPaid: schedule.totalPaid,
        outstandingAmount: schedule.getOutstandingAmount(),
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        loan,
        schedule,
        paymentRecord,
      },
    });
  } catch (error) {
    await session.abortTransaction();

    await LoanAudit.logAction({
      action: 'payment_recorded',
      loan: loanId,
      actor: req.user._id,
      actorRole: req.user.role,
      status: 'failed',
      error: {
        message: error.message,
      },
    });

    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Get loan status and details
 * GET /api/loans/:loanId
 */
exports.getLoanStatus = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  const loan = await Loan.findById(loanId)
    .populate('user', 'name email phone')
    .populate('group', 'name')
    .populate('approvedBy', 'name email');

  if (!loan) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found',
    });
  }

  // Authorization: user can only see their own loans, admins can see all
  if (req.user.role !== 'admin' && !loan.user._id.equals(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to view this loan',
    });
  }

  // Get schedule if exists
  let schedule = null;
  if (loan.repaymentSchedule) {
    schedule = await LoanRepaymentSchedule.findById(loan.repaymentSchedule);
  }

  res.json({
    success: true,
    data: {
      loan,
      schedule,
    },
  });
});

/**
 * Get user's loans
 * GET /api/loans/user/my-loans
 */
exports.getUserLoans = asyncHandler(async (req, res) => {
  const loans = await Loan.find({ user: req.user._id })
    .populate('group', 'name')
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: loans.length,
    data: loans,
  });
});

/**
 * Get group loans (admin/group_admin only)
 * GET /api/loans/group/:groupId
 */
exports.getGroupLoans = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { status, skip = 0, limit = 20 } = req.query;

  // Authorization
  if (req.user.role !== 'admin' && req.user.role !== 'group_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can view group loans',
    });
  }

  const query = { group: groupId };
  if (status) {
    query.status = status;
  }

  const [loans, total] = await Promise.all([
    Loan.find(query)
      .populate('user', 'name email phone')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit)),
    Loan.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: loans.length,
    total,
    skip: parseInt(skip),
    limit: parseInt(limit),
    data: loans,
  });
});
