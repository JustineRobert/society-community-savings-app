/**
 * controllers/loanController.js
 *
 * HTTP handlers for loan operations using LoanWorkflowService.
 *
 * Features:
 * - Loan application creation and lifecycle
 * - Loan approval/rejection/disbursement (admin/finance only)
 * - Repayment recording with validation
 * - Repayment schedule generation
 * - Loan status tracking and updates
 * - Overdue and default detection
 * - Comprehensive audit trail
 * - Role-based access control
 *
 * All operations require authentication via req.user._id
 * Admin operations require admin role
 */
const CreditScoringService = require('../services/creditScoringService');
const ComplianceLog = require('../models/ComplianceLog'); // ensure ComplianceLog is imported for STR logging

const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

// ✅ REQUIRED IMPORTS (Fixes ALL no-undef errors)

const mongoose = require('mongoose');

const Loan = require('../models/Loan');
const LoanAudit = require('../models/LoanAudit');
const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
const Group = require('../models/Group');

const { assessEligibility } = require('../services/loanScoringService'); // adjust if path differs
``

/**
 * Helper: Ensure user is authenticated
 */
function ensureAuth(req) {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    const err = new Error('User authentication required');
    err.status = 401;
    throw err;
  }
  return userId;
}

/**
 * Helper: Ensure user has admin role
 */
function ensureAdmin(req) {
  const userId = ensureAuth(req);
  const roles = req.user?.roles || [];

  if (!roles.includes('admin')) {
    const err = new Error('Admin access required');
    err.status = 403;
    throw err;
  }

  return userId;
}

/**
 * Helper: Create HTTP error
 */
function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/**
 * POST /api/loans
 * Create a new loan application
 *
 * Body: {
 *   amount: number (required),
 *   duration: number (months, required),
 *   interestRate: number (percentage, optional, default 5),
 *   purpose: string (optional),
 *   description: string (optional)
 * }
 *
 * Returns: loan application object
 */
exports.createLoanApplication = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { amount, duration, interestRate, purpose, description } = req.body;
    const loanService = req.app.locals.loanWorkflowService;

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    if (!amount || amount <= 0) {
      throw httpError(400, 'amount must be positive number');
    }

    if (!duration || duration < 1 || duration > 360) {
      throw httpError(400, 'duration must be between 1 and 360 months');
    }

    const loanData = {
      amount,
      duration,
      interestRate: interestRate || 5,
      purpose: purpose || undefined,
      description: description || undefined,
    };

    const result = await loanService.createLoanApplication(userId, loanData);

    res.status(201).json({
      message: 'Loan application created successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/loans
 * List user's loans (or all loans if admin)
 *
 * Query: ?page=1&limit=20&status=active&sortBy=createdAt
 * Returns: array of loan objects with pagination
 */
exports.listLoans = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const loanService = req.app.locals.loanWorkflowService;
    //const Loan = require('../models/Loan'); //Remove ALL duplicates.

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const status = req.query.status || null;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Build filter
    const isAdmin = req.user?.roles?.includes('admin');
    const filter = isAdmin ? {} : { borrower: userId };

    if (status) {
      filter.status = status;
    }

    // Query
    const [loans, total] = await Promise.all([
      Loan.find(filter)
        .select('_id borrower amount duration interestRate status createdAt updatedAt')
        .populate('borrower', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments(filter),
    ]);

    res.status(200).json({
      message: 'Loans retrieved successfully',
      data: loans,
      pagination: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/loans/:loanId
 * Get loan details with full information
 *
 * Returns: loan object with borrower populated
 */
exports.getLoanDetail = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { loanId } = req.params;
    const Loan = require('../models/Loan');

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }

    const loan = await Loan.findById(loanId).populate('borrower', 'name email');

    if (!loan) {
      throw httpError(404, 'Loan not found');
    }

    // Check ownership or admin
    const isAdmin = req.user?.roles?.includes('admin');
    const isOwner = String(loan.borrower._id) === String(userId);

    if (!isOwner && !isAdmin) {
      throw httpError(403, 'Not authorized to view this loan');
    }

    res.status(200).json({
      message: 'Loan details retrieved successfully',
      data: loan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/loans/:loanId/approve
 * Approve a pending loan application (admin only)
 *
 * Body: {
 *   notes: string (optional)
 * }
 *
 * Returns: updated loan object with status='approved'
 */
exports.approveLoan = async (req, res, next) => {
  try {
    const adminId = ensureAdmin(req);
    const { loanId } = req.params;
    const { notes } = req.body;
    const loanService = req.app.locals.loanWorkflowService;

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }

    const result = await loanService.changeLoanStatus(loanId, 'approved', adminId, {
      reason: notes || 'Approved by admin',
    });

    logger.info('Loan approved', {
      loanId,
      adminId,
      amount: result.amount,
    });

    res.status(200).json({
      message: 'Loan approved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/loans/:loanId/reject
 * Reject a pending loan application (admin only)
 *
 * Body: {
 *   reason: string (required)
 * }
 *
 * Returns: updated loan object with status='rejected'
 */
exports.rejectLoan = async (req, res, next) => {
  try {
    const adminId = ensureAdmin(req);
    const { loanId } = req.params;
    const { reason } = req.body;
    const loanService = req.app.locals.loanWorkflowService;

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }
    if (!reason) {
      throw httpError(400, 'reason is required');
    }

    const result = await loanService.changeLoanStatus(loanId, 'rejected', adminId, {
      reason,
    });

    logger.info('Loan rejected', {
      loanId,
      adminId,
      reason,
    });

    res.status(200).json({
      message: 'Loan rejected successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/loans/:loanId/disburse
 * Disburse an approved loan (admin/finance only)
 * Generates repayment schedule and sets status to 'active'
 *
 * Body: {
 *   notes: string (optional)
 * }
 *
 * Returns: updated loan object with repayment schedule
 */
exports.disburseLoan = async (req, res, next) => {
  try {
    const adminId = ensureAdmin(req);
    const { loanId } = req.params;
    const { notes } = req.body;
    const loanService = req.app.locals.loanWorkflowService;

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }

    // Change status to disbursed then generate schedule
    let result = await loanService.changeLoanStatus(loanId, 'disbursed', adminId, {
      reason: notes || 'Disbursed by admin',
    });

    // Generate repayment schedule
    result = await loanService.changeLoanStatus(loanId, 'active', adminId, {
      reason: 'Generating repayment schedule',
    });

    // Generate schedule
    const scheduleResult = await loanService.generateRepaymentSchedule(
      loanId,
      result.amount,
      result.duration,
      result.interestRate
    );

    logger.info('Loan disbursed', {
      loanId,
      adminId,
      amount: result.amount,
      scheduleCount: scheduleResult.length,
    });

    res.status(200).json({
      message: 'Loan disbursed successfully',
      data: result,
      schedule: scheduleResult,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/loans/:loanId/repayment
 * Record a repayment for a loan
 *
 * Body: {
 *   amount: number (required),
 *   method: string (optional, e.g., 'bank_transfer', 'mobile_money'),
 *   reference: string (optional, transaction ID)
 * }
 *
 * Returns: updated loan with new repayment record
 */
exports.recordRepayment = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { loanId } = req.params;
    const { amount, method, reference } = req.body;
    const loanService = req.app.locals.loanWorkflowService;

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }
    if (!amount || amount <= 0) {
      throw httpError(400, 'amount must be positive number');
    }

    const repaymentData = {
      amount,
      method: method || 'unspecified',
      reference: reference || undefined,
    };

    const result = await loanService.recordRepayment(loanId, userId, repaymentData);

    logger.info('Repayment recorded', {
      loanId,
      userId,
      amount,
    });

    res.status(201).json({
      message: 'Repayment recorded successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/loans/:loanId/schedule
 * Get the repayment schedule for a loan
 *
 * Query: ?page=1&limit=50&status=pending
 * Returns: array of installment objects
 */
exports.getRepaymentSchedule = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { loanId } = req.params;
    const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
    const Loan = require('../models/Loan');

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }

    // Check ownership
    const loan = await Loan.findById(loanId).select('borrower');
    if (!loan) {
      throw httpError(404, 'Loan not found');
    }

    const isAdmin = req.user?.roles?.includes('admin');
    const isOwner = String(loan.borrower) === String(userId);

    if (!isOwner && !isAdmin) {
      throw httpError(403, 'Not authorized to view this schedule');
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status || null;

    // Build filter
    const filter = { loan: loanId };
    if (statusFilter) {
      filter.status = statusFilter;
    }

    // Query
    const [schedule, total] = await Promise.all([
      LoanRepaymentSchedule.find(filter)
        .select('installmentNumber dueDate amount status daysOverdue')
        .sort({ installmentNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanRepaymentSchedule.countDocuments(filter),
    ]);

    res.status(200).json({
      message: 'Repayment schedule retrieved successfully',
      data: schedule,
      pagination: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/loans/:loanId/summary
 * Get loan summary with progress and statistics
 *
 * Returns: loan summary with remaining balance, paid amount, overdue info
 */
exports.getLoanSummary = async (req, res, next) => {
  try {
    const userId = ensureAuth(req);
    const { loanId } = req.params;
    const loanService = req.app.locals.loanWorkflowService;

    if (!loanService) {
      return res.status(500).json({ error: 'Loan service not initialized' });
    }

    if (!loanId) {
      throw httpError(400, 'loanId is required');
    }

    const result = await loanService.getLoanSummary(loanId, userId);

    res.status(200).json({
      message: 'Loan summary retrieved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};


// Approve loan (admin/group_admin only) - with credit scoring guard
PUT /api/loans/loanId/approve; 

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
  const loan = await Loan.findById(loanId).populate('user', 'name email phone tenantId nationalId avgTransaction');
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

  // ---------------------------
  // CREDIT SCORING GUARD (NEW)
  // ---------------------------
  try {
    // Build features payload for scoring. Prefer aggregated metrics if available on user,
    // otherwise use conservative defaults and minimal loan context.
    const features = {
      contributions: loan.user?.contributionsCount || 0,
      loanRepaymentsOnTime: loan.user?.onTimeRepayments || false,
      missedPayments: loan.user?.missedPayments || 0,
      momoInflows: loan.user?.momoInflows || 0,
      momoOutflows: loan.user?.momoOutflows || 0,
      savingsConsistency: loan.user?.savingsConsistency || false,
      groupParticipation: !!loan.group,
      guarantorStrength: loan.guarantorStrength || 'unknown',
      // include loan context to help scoring
      requestedAmount: loan.amount,
      requestedDurationMonths: loan.repaymentPeriodMonths || repaymentPeriodMonths
    };

    // Call scoring service (fast path). Service returns { score, riskLevel }.
    const { score, riskLevel } = await CreditScoringService.calculateScore(loan.user, features);

    // Map to decision
    // <400 → Reject
    // 401–650 → Manual Review
    // >650 → Approve
    if (score < 400) {
      // Audit: record attempted approval and rejection reason
      await LoanAudit.logAction({
        action: 'loan_approval_blocked_by_score',
        loan: loan._id,
        user: loan.user._id,
        group: loan.group?._id || null,
        actor: req.user._id,
        actorRole: req.user.role,
        description: `Loan approval blocked by credit score (${score})`,
        amount: loan.amount,
        metadata: { score, riskLevel, features },
        status: 'blocked'
      });

      // Optionally create a compliance log / STR if score is extremely low or suspicious
      if (score < 200) {
        try {
          await ComplianceLog.createSTR({
            tenantId: loan.user.tenantId || 'unknown',
            userId: loan.user._id,
            activity: 'STR_GENERATED',
            flagged: true,
            reason: 'Very low credit score on approval attempt',
            details: { score, riskLevel, loanId: loan._id, actor: req.user._id },
            fraudLogId: null,
            reporter: 'credit-scoring'
          });
        } catch (e) {
          // non-fatal: log and continue
          logger.warn('Failed to create STR for low score', e.message || e);
        }
      }

      return res.status(400).json({
        success: false,
        message: 'Loan rejected due to credit risk',
        data: { score, riskLevel }
      });
    }

    if (score <= 650) {
      // Move to manual review workflow instead of auto-approve
      loan.status = 'manual_review';
      loan.reviewRequestedBy = req.user._id;
      loan.reviewRequestedAt = new Date();
      await loan.save();

      await LoanAudit.logAction({
        action: 'loan_marked_manual_review',
        loan: loan._id,
        user: loan.user._id,
        group: loan.group?._id || null,
        actor: req.user._id,
        actorRole: req.user.role,
        description: `Loan moved to manual review due to credit score (${score})`,
        amount: loan.amount,
        metadata: { score, riskLevel, features },
        status: 'pending'
      });

      return res.status(202).json({
        success: true,
        message: 'Loan requires manual review due to risk profile',
        data: { score, riskLevel }
      });
    }

    // score > 650 → proceed to approval path
    // record score in RiskProfile (upsert) for auditability and future reference
    try {
      await RiskProfile.upsertScore(loan.user._id, loan.user.tenantId || 'default', score, {
        explain: { source: 'creditScoringService', features },
        modelVersion: process.env.CREDIT_MODEL_VERSION || 'v1',
        source: 'hybrid'
      });
    } catch (e) {
      logger.warn('RiskProfile upsert failed during approval flow', e.message || e);
    }
  } catch (scoringErr) {
    // If scoring service fails, fail-safe: do not auto-approve. Log and escalate.
    logger.error('Credit scoring failed during approval', { error: scoringErr?.message || scoringErr, loanId, actor: req.user._id });

    await LoanAudit.logAction({
      action: 'loan_approval_scoring_error',
      loan: loan._id,
      user: loan.user._id,
      group: loan.group?._id || null,
      actor: req.user._id,
      actorRole: req.user.role,
      description: 'Credit scoring service error during approval',
      metadata: { error: scoringErr?.message || String(scoringErr) },
      status: 'failed'
    });

    // Conservative response: require manual review
    loan.status = 'manual_review';
    loan.reviewRequestedBy = req.user._id;
    loan.reviewRequestedAt = new Date();
    await loan.save();

    return res.status(202).json({
      success: false,
      message: 'Credit scoring unavailable; loan moved to manual review',
    });
  }
  // ---------------------------
  // END CREDIT SCORING GUARD
  // ---------------------------

  // Proceed with original approval flow (transactional)
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

/**
 * Get loan repayment schedule and status
 * GET /api/loans/:loanId/schedule
 */
exports.getLoanSchedule = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  const loan = await Loan.findById(loanId).populate('user');

  if (!loan) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found',
    });
  }

  // Authorization
  if (req.user.role !== 'admin' && !loan.user._id.equals(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to view this schedule',
    });
  }

  const schedule = await LoanRepaymentSchedule.findById(loan.repaymentSchedule);

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Repayment schedule not found',
    });
  }

  // Calculate summary
  const totalPaid = schedule.totalPaid || 0;
  const outstandingAmount = schedule.totalAmount - totalPaid;
  const paidInstallments = (schedule.installments || []).filter((i) => i.paid).length;
  const totalInstallments = schedule.installments?.length || 0;

  res.json({
    success: true,
    data: {
      loan: {
        id: loan._id,
        amount: loan.amount,
        status: loan.status,
        approvedAt: loan.approvedAt,
        disburseDate: loan.disburseDate,
        repaidAt: loan.repaidAt,
      },
      schedule: {
        id: schedule._id,
        totalAmount: schedule.totalAmount,
        totalPaid,
        outstandingAmount,
        interestRate: schedule.interestRate,
        status: schedule.status,
        paidInstallments,
        totalInstallments,
        installments: schedule.installments,
      },
      summary: {
        percentagePaid: totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0,
        remainingInstallments: totalInstallments - paidInstallments,
        nextDueDate: (schedule.installments || []).find((i) => !i.paid)?.dueDate || null,
      },
    },
  });
});

/**
 * Request loan (user-facing endpoint)
 * POST /api/loans/request
 * Body: { groupId, amount, reason, repaymentTermMonths }
 */
exports.requestLoan = asyncHandler(async (req, res) => {
  const { groupId, amount, reason, repaymentTermMonths, idempotencyKey } = req.body;

  // Validation
  if (!groupId || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Group ID and amount are required',
      errors: {
        groupId: !groupId ? 'Required' : undefined,
        amount: !amount ? 'Required' : undefined,
      },
    });
  }

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid group ID format',
    });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be a positive number',
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

  // Check eligibility
  const eligibility = await assessEligibility(req.user._id, groupId, req.user._id);

  if (!eligibility.isEligible) {
    return res.status(403).json({
      success: false,
      message: 'You are not eligible to apply for a loan',
      eligibility: {
        isEligible: false,
        rejectionReason: eligibility.rejectionReason,
        score: eligibility.overallScore,
      },
    });
  }

  // Validate amount against max
  if (amount > eligibility.maxLoanAmount) {
    return res.status(400).json({
      success: false,
      message: 'Requested amount exceeds your borrowing limit',
      maxAllowed: eligibility.maxLoanAmount,
    });
  }

  // Check for existing active loans
  const existingActive = await Loan.findOne({
    user: req.user._id,
    group: groupId,
    status: { $in: ['pending', 'approved', 'disbursed'] },
  });

  if (existingActive) {
    return res.status(409).json({
      success: false,
      message: 'You already have an active loan application or disbursed loan in this group',
    });
  }

  // Check idempotency
  if (idempotencyKey) {
    const existingByKey = await Loan.findOne({
      user: req.user._id,
      group: groupId,
      idempotencyKey,
    });

    if (existingByKey) {
      return res.status(200).json({
        success: true,
        message: 'Loan request already exists',
        isDuplicate: true,
        data: existingByKey,
      });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const loanData = {
      user: req.user._id,
      group: groupId,
      amount,
      reason: reason || null,
      repaymentTermMonths: repaymentTermMonths || 6,
      status: 'pending',
      eligibilityScore: eligibility.overallScore,
      idempotencyKey,
    };

    const loan = new Loan(loanData);
    await loan.save({ session });

    // Audit log
    await LoanAudit.logAction({
      action: 'loan_requested',
      loan: loan._id,
      user: req.user._id,
      group: groupId,
      actor: req.user._id,
      actorRole: req.user.role,
      description: `Loan request submitted: ${amount} in ${groupId}`,
      amount,
      metadata: {
        eligibilityScore: eligibility.overallScore,
        requestedTerm: repaymentTermMonths,
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Loan request submitted successfully',
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
 * Batch update loan statuses (admin only)
 * PATCH /api/loans/batch
 * Body: { loanIds, newStatus, reason }
 */
exports.updateLoansInBatch = asyncHandler(async (req, res) => {
  const { loanIds, newStatus, reason } = req.body;

  // Authorization
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can perform batch operations',
    });
  }

  if (!Array.isArray(loanIds) || loanIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid loan IDs array is required',
    });
  }

  if (!['approved', 'rejected', 'cancelled'].includes(newStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updates = { status: newStatus };
    const dateField = newStatus === 'approved' ? 'approvedAt' : `${newStatus}At`;
    updates[dateField] = new Date();

    if (newStatus === 'rejected') {
      updates.rejectionReason = reason || 'Rejected in batch operation';
    }

    const result = await Loan.updateMany({ _id: { $in: loanIds } }, updates, { session });

    // Audit batch update
    await LoanAudit.logAction({
      action: 'loans_batch_updated',
      actor: req.user._id,
      actorRole: req.user.role,
      description: `Batch updated ${result.modifiedCount} loans to ${newStatus}`,
      metadata: {
        loanCount: loanIds.length,
        newStatus,
        reason,
      },
      status: 'success',
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} loans`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Get loan statistics for a group
 * GET /api/loans/group/:groupId/statistics
 */
exports.getGroupLoanStatistics = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  // Authorization
  if (req.user.role !== 'admin' && req.user.role !== 'group_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can view statistics',
    });
  }

  const stats = await Loan.aggregate([
    { $match: { group: mongoose.Types.ObjectId(groupId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' },
      },
    },
  ]);

  // Get summary across all statuses
  const allLoans = await Loan.find({ group: groupId });
  const totalLoans = allLoans.length;
  const totalLoanAmount = allLoans.reduce((sum, l) => sum + l.amount, 0);
  const totalRepaid = allLoans
    .filter((l) => l.status === 'repaid')
    .reduce((sum, l) => sum + l.amount, 0);

  // Get default rate
  const defaultedSchedules = await LoanRepaymentSchedule.countDocuments({
    status: 'defaulted',
  });

  res.json({
    success: true,
    data: {
      summary: {
        totalLoans,
        totalLoanAmount,
        totalRepaid,
        defaultRate: totalLoans > 0 ? (defaultedSchedules / totalLoans) * 100 : 0,
        averageLoanAmount: totalLoans > 0 ? totalLoanAmount / totalLoans : 0,
      },
      byStatus: stats,
    },
  });
});
