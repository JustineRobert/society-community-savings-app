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
const asyncHandler = require('../utils/asyncHandler');

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

/**
 * Get detailed loan analytics
 * GET /api/admin/analytics/loans
 */
exports.getLoanAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      startDate = new Date('2000-01-01');
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const statusStats = await Loan.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
      },
    },
  ]);

  // Loan creation trend (daily)
  const trendData = await Loan.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Default analysis
  const repaymentData = await require('../models/LoanRepaymentSchedule').aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period,
      statusDistribution: statusStats,
      creationTrend: trendData,
      repaymentStatus: repaymentData,
      summary: {
        totalLoansInPeriod: statusStats.reduce((sum, s) => sum + s.count, 0),
        totalAmountInPeriod: statusStats.reduce((sum, s) => sum + s.totalAmount, 0),
      },
    },
  });
});

/**
 * Get user engagement metrics
 * GET /api/admin/analytics/users
 */
exports.getUserAnalytics = asyncHandler(async (req, res) => {
  // Most active users (by contribution count)
  const activeUsers = await User.aggregate([
    {
      $lookup: {
        from: 'contributions',
        localField: '_id',
        foreignField: 'user',
        as: 'userContributions',
      },
    },
    {
      $lookup: {
        from: 'loans',
        localField: '_id',
        foreignField: 'user',
        as: 'userLoans',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        isVerified: 1,
        role: 1,
        contributionCount: { $size: '$userContributions' },
        totalContributed: { $sum: '$userContributions.amount' },
        loanCount: { $size: '$userLoans' },
        createdAt: 1,
      },
    },
    { $sort: { totalContributed: -1 } },
    { $limit: 20 },
  ]);

  // Verification status
  const verificationStats = await User.aggregate([
    {
      $group: {
        _id: '$isVerified',
        count: { $sum: 1 },
      },
    },
  ]);

  // Role distribution
  const roleStats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      topUsers: activeUsers,
      verification: verificationStats,
      roleDistribution: roleStats,
    },
  });
});

/**
 * Get system health status
 * GET /api/admin/system/health
 */
exports.getSystemHealth = asyncHandler(async (req, res) => {
  const start = Date.now();
  
  try {
    // Database connectivity test
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Query performance (measure response time)
    const userCount = await User.countDocuments();
    const queryTime = Date.now() - start;
    
    // Check for overdue loans/payments
    const now = new Date();
    const overdueCount = await require('../models/LoanRepaymentSchedule').countDocuments({
      'installments.dueDate': { $lt: now },
      'installments.paid': false,
    });

    res.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          connected: dbStatus === 'connected',
        },
        performance: {
          queryTime: `${queryTime}ms`,
          status: queryTime < 100 ? 'healthy' : queryTime < 500 ? 'acceptable' : 'slow',
        },
        data: {
          totalUsers: userCount,
          overdueLoans: overdueCount,
          timestamp: new Date(),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'System health check failed',
      error: error.message,
    });
  }
});

/**
 * Get payment analytics
 * GET /api/admin/analytics/payments
 */
exports.getPaymentAnalytics = asyncHandler(async (req, res) => {
  const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
  
  // Payment status summary
  const paymentStats = await LoanRepaymentSchedule.aggregate([
    {
      $facet: {
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
            },
          },
        ],
        installmentAnalysis: [
          { $unwind: '$installments' },
          {
            $group: {
              _id: '$installments.paid',
              count: { $sum: 1 },
              totalAmount: { $sum: '$installments.amount' },
            },
          },
        ],
        collectionRate: [
          {
            $group: {
              _id: null,
              totalSchedules: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              totalPaid: { $sum: '$totalPaid' },
            },
          },
        ],
      },
    },
  ]);

  const collectionRate = paymentStats[0]?.collectionRate[0];
  const percentPaid = collectionRate 
    ? ((collectionRate.totalPaid / collectionRate.totalAmount) * 100).toFixed(2)
    : 0;

  res.json({
    success: true,
    data: {
      scheduleStatus: paymentStats[0]?.byStatus || [],
      installmentStatus: paymentStats[0]?.installmentAnalysis || [],
      collectionMetrics: {
        totalSchedules: collectionRate?.totalSchedules || 0,
        totalAmount: collectionRate?.totalAmount || 0,
        totalPaid: collectionRate?.totalPaid || 0,
        collectionRate: `${percentPaid}%`,
      },
    },
  });
});

/**
 * Generate compliance report
 * GET /api/admin/reports/compliance
 */
exports.getComplianceReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // High-risk loans (overdue)
  const riskyLoans = await require('../models/LoanRepaymentSchedule').find({
    $expr: {
      $gt: [
        {
          $size: {
            $filter: {
              input: '$installments',
              as: 'inst',
              cond: {
                $and: [
                  { $lt: ['$$inst.dueDate', now] },
                  { $eq: ['$$inst.paid', false] },
                ],
              },
            },
          },
        },
        0,
      ],
    },
  }).populate('loan');

  // Recent defaults
  const recentDefaults = await require('../models/LoanAudit').find({
    action: 'loan_defaulted',
    createdAt: { $gte: thirtyDaysAgo },
  }).populate('loan').populate('user');

  // Verification compliance
  const unverifiedUsers = await User.countDocuments({ isVerified: false });
  const totalUsers = await User.countDocuments();
  const verificationRate = ((totalUsers - unverifiedUsers) / totalUsers) * 100;

  res.json({
    success: true,
    data: {
      riskAssessment: {
        highRiskLoans: riskyLoans.length,
        recentDefaults: recentDefaults.length,
        overallRiskScore: (riskyLoans.length + recentDefaults.length) * 10, // Simple scoring
      },
      compliance: {
        userVerificationRate: `${verificationRate.toFixed(2)}%`,
        verifiedUsers: totalUsers - unverifiedUsers,
        unverifiedUsers,
        totalUsers,
      },
      recentIssues: {
        overdueLoans: riskyLoans,
        defaults: recentDefaults.slice(0, 10),
      },
      timestamp: new Date(),
    },
  });
});

module.exports = exports;
