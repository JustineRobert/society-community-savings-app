/**
 * adminController.js
 * 
 * Production-grade admin dashboard
 * User management, loan oversight, risk analysis, system metrics
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');
const Loan = require('../models/Loan');
const Contribution = require('../models/Contribution');
const LoanAudit = require('../models/LoanAudit');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Admin authorization middleware
 */
exports.requireAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
});

/**
 * Get system dashboard metrics
 * GET /api/admin/dashboard
 */
exports.getDashboardMetrics = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    verifiedUsers,
    totalGroups,
    activeGroups,
    totalContributions,
    totalLoans,
    disbursedLoans,
    repaidLoans,
    defaultedLoans,
    pendingLoans,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isVerified: true }),
    Group.countDocuments(),
    Group.countDocuments({ status: 'active' }),
    Contribution.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Loan.countDocuments(),
    Loan.countDocuments({ status: 'disbursed' }),
    Loan.countDocuments({ status: 'repaid' }),
    Loan.countDocuments({ status: 'defaulted' }),
    Loan.countDocuments({ status: 'pending' }),
  ]);

  const totalContributionsAmount = totalContributions[0]?.total || 0;
  const disbursedLoansAmount = await Loan.aggregate([
    { $match: { status: 'disbursed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const defaultRate = totalLoans > 0 ? ((defaultedLoans / totalLoans) * 100).toFixed(2) : 0;

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        unverified: totalUsers - verifiedUsers,
      },
      groups: {
        total: totalGroups,
        active: activeGroups,
      },
      contributions: {
        total: totalContributionsAmount,
        count: (await Contribution.countDocuments()) || 0,
      },
      loans: {
        total: totalLoans,
        disbursed: disbursedLoans,
        disbursedAmount: disbursedLoansAmount[0]?.total || 0,
        repaid: repaidLoans,
        defaulted: defaultedLoans,
        pending: pendingLoans,
        defaultRate: `${defaultRate}%`,
      },
      timestamp: new Date(),
    },
  });
});

/**
 * Get user management list
 * GET /api/admin/users?status=all&skip=0&limit=20
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const { status = 'all', skip = 0, limit = 20, search = '' } = req.query;

  const query = {};

  if (status === 'verified') {
    query.isVerified = true;
  } else if (status === 'unverified') {
    query.isVerified = false;
  } else if (status === 'suspended') {
    query.status = 'suspended';
  }

  // Search by name or email
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('name email phone role isVerified status createdAt')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }),
    User.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: users.length,
    total,
    skip: parseInt(skip),
    limit: parseInt(limit),
    data: users,
  });
});

/**
 * Get single user details with activity
 * GET /api/admin/users/:userId
 */
exports.getUserDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('-password -resetPasswordToken -verificationToken');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Get user activity
  const [groups, loans, contributions, auditLog] = await Promise.all([
    Group.find({ members: userId }).select('name status createdAt'),
    Loan.find({ user: userId }).select('group amount status createdAt'),
    Contribution.find({ user: userId }).select('group amount createdAt'),
    LoanAudit.find({ user: userId }).limit(10).sort({ createdAt: -1 }),
  ]);

  res.json({
    success: true,
    data: {
      user,
      activity: {
        groups: groups.length,
        loans: loans.length,
        contributions: contributions.length,
      },
      recentActivity: auditLog,
    },
  });
});

/**
 * Verify user account
 * PUT /api/admin/users/:userId/verify
 */
exports.verifyUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  if (user.isVerified) {
    return res.status(400).json({
      success: false,
      message: 'User is already verified',
    });
  }

  user.isVerified = true;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  await user.save();

  // Audit
  await LoanAudit.logAction({
    action: 'user_verified',
    user: user._id,
    actor: req.user._id,
    actorRole: 'admin',
    description: `User ${user.email} manually verified by admin`,
    status: 'success',
  });

  res.json({
    success: true,
    message: 'User verified successfully',
    data: user,
  });
});

/**
 * Suspend user account
 * PUT /api/admin/users/:userId/suspend
 * Body: { reason }
 */
exports.suspendUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Suspension reason is required',
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  user.status = 'suspended';
  user.suspensionReason = reason;
  user.suspendedAt = new Date();
  await user.save();

  // Audit
  await LoanAudit.logAction({
    action: 'user_suspended',
    user: user._id,
    actor: req.user._id,
    actorRole: 'admin',
    description: `User suspended: ${reason}`,
    status: 'success',
  });

  res.json({
    success: true,
    message: 'User suspended successfully',
    data: user,
  });
});

/**
 * Activate suspended user
 * PUT /api/admin/users/:userId/activate
 */
exports.activateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  if (user.status !== 'suspended') {
    return res.status(400).json({
      success: false,
      message: 'User is not suspended',
    });
  }

  user.status = 'active';
  user.suspensionReason = null;
  user.suspendedAt = null;
  await user.save();

  // Audit
  await LoanAudit.logAction({
    action: 'user_activated',
    user: user._id,
    actor: req.user._id,
    actorRole: 'admin',
    description: 'User account reactivated',
    status: 'success',
  });

  res.json({
    success: true,
    message: 'User activated successfully',
    data: user,
  });
});

/**
 * Get loan risk overview
 * GET /api/admin/loan-risk
 */
exports.getLoanRiskOverview = asyncHandler(async (req, res) => {
  // At-risk loans: overdue payments
  const atRiskLoans = await Loan.aggregate([
    {
      $lookup: {
        from: 'loanrepaymentschedules',
        localField: '_id',
        foreignField: 'loan',
        as: 'schedule',
      },
    },
    {
      $match: {
        status: 'disbursed',
        'schedule.status': { $in: ['overdue', 'default'] },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  // Loans approaching maturity
  const approachingMaturity = await Loan.countDocuments({
    status: 'disbursed',
    repaymentDate: {
      $gte: new Date(),
      $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Default analysis
  const defaultAnalysis = await Loan.aggregate([
    { $match: { status: 'defaulted' } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      atRisk: atRiskLoans[0] || { count: 0, totalAmount: 0 },
      approachingMaturity,
      defaultAnalysis: defaultAnalysis[0] || {
        count: 0,
        totalAmount: 0,
        avgAmount: 0,
      },
    },
  });
});

/**
 * Get group oversight
 * GET /api/admin/groups?skip=0&limit=20
 */
exports.getGroupOversight = asyncHandler(async (req, res) => {
  const { skip = 0, limit = 20 } = req.query;

  const groups = await Group.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'members',
        foreignField: '_id',
        as: 'memberDetails',
      },
    },
    {
      $lookup: {
        from: 'loans',
        localField: '_id',
        foreignField: 'group',
        as: 'loans',
      },
    },
    {
      $lookup: {
        from: 'contributions',
        localField: '_id',
        foreignField: 'group',
        as: 'contributions',
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        status: 1,
        memberCount: { $size: '$memberDetails' },
        totalContributions: { $sum: '$contributions.amount' },
        loanCount: { $size: '$loans' },
        activeLoanCount: {
          $size: {
            $filter: {
              input: '$loans',
              as: 'loan',
              cond: { $eq: ['$$loan.status', 'disbursed'] },
            },
          },
        },
        createdAt: 1,
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: parseInt(skip) },
    { $limit: parseInt(limit) },
  ]);

  const total = await Group.countDocuments();

  res.json({
    success: true,
    count: groups.length,
    total,
    skip: parseInt(skip),
    limit: parseInt(limit),
    data: groups,
  });
});

/**
 * Get audit trail
 * GET /api/admin/audit-log?action=&skip=0&limit=50
 */
exports.getAuditLog = asyncHandler(async (req, res) => {
  const { action, skip = 0, limit = 50 } = req.query;

  const query = {};
  if (action) {
    query.action = action;
  }

  const [logs, total] = await Promise.all([
    LoanAudit.find(query)
      .populate('actor', 'name email role')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit)),
    LoanAudit.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: logs.length,
    total,
    skip: parseInt(skip),
    limit: parseInt(limit),
    data: logs,
  });
});

module.exports = exports;
