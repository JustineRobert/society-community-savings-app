/**
 * performanceOptimization.js
 * 
 * Database indexing, query optimization, and caching strategies
 * Production-ready performance tuning for community savings app
 */

const mongoose = require('mongoose');

/**
 * Database Indexing Strategy
 * Ensures optimal query performance across all collections
 */
const indexingStrategy = {
  /**
   * User indexes
   * Primary lookups: email, phone, role, verification status
   */
  userIndexes: [
    { spec: { email: 1 }, options: { unique: true, sparse: true, background: true } },
    { spec: { phone: 1 }, options: { unique: true, sparse: true, background: true } },
    { spec: { role: 1 }, options: { background: true } },
    { spec: { isVerified: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
  ],

  /**
   * Group indexes
   * Primary lookups: admin, status, members, creation date
   */
  groupIndexes: [
    { spec: { admin: 1 }, options: { background: true } },
    { spec: { status: 1 }, options: { background: true } },
    { spec: { members: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
    { spec: { admin: 1, status: 1 }, options: { background: true } }, // Compound index
  ],

  /**
   * Loan indexes
   * Critical: user/group/status lookups, date range queries
   */
  loanIndexes: [
    { spec: { user: 1, group: 1 }, options: { background: true } },
    { spec: { group: 1, status: 1 }, options: { background: true } },
    { spec: { status: 1 }, options: { background: true } },
    { spec: { user: 1, status: 1 }, options: { background: true } },
    { spec: { approvedBy: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
    { spec: { group: 1, createdAt: -1 }, options: { background: true } }, // Compound for sorting
    { spec: { user: 1, createdAt: -1 }, options: { background: true } },
  ],

  /**
   * Contribution indexes
   * Lookups: user/group/status, analytics queries
   */
  contributionIndexes: [
    { spec: { user: 1, group: 1 }, options: { background: true } },
    { spec: { group: 1 }, options: { background: true } },
    { spec: { status: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
    { spec: { user: 1, createdAt: -1 }, options: { background: true } },
    { spec: { group: 1, createdAt: -1 }, options: { background: true } },
    { spec: { group: 1, status: 1 }, options: { background: true } },
  ],

  /**
   * LoanRepaymentSchedule indexes
   * Lookups: loan, status, overdue detection
   */
  repaymentScheduleIndexes: [
    { spec: { loan: 1 }, options: { unique: true, background: true } },
    { spec: { status: 1 }, options: { background: true } },
    { spec: { 'installments.dueDate': 1 }, options: { background: true } },
    { spec: { 'installments.paid': 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
  ],

  /**
   * LoanEligibility indexes
   * Lookups: user/group assessments, caching, expiration
   */
  loanEligibilityIndexes: [
    { spec: { user: 1, group: 1 }, options: { background: true } },
    { spec: { user: 1, expiresAt: 1 }, options: { background: true, expireAfterSeconds: 0 } }, // TTL index
    { spec: { createdAt: -1 }, options: { background: true } },
  ],

  /**
   * LoanAudit indexes
   * Lookups: user/loan/action, compliance audits, date range
   */
  loanAuditIndexes: [
    { spec: { user: 1 }, options: { background: true } },
    { spec: { loan: 1 }, options: { background: true } },
    { spec: { action: 1 }, options: { background: true } },
    { spec: { actor: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
    { spec: { user: 1, createdAt: -1 }, options: { background: true } },
    { spec: { action: 1, createdAt: -1 }, options: { background: true } },
  ],

  /**
   * Chat indexes
   * Lookups: sender/recipient/group/room, message ordering
   */
  chatIndexes: [
    { spec: { group: 1, createdAt: -1 }, options: { background: true } },
    { spec: { sender: 1 }, options: { background: true } },
    { spec: { recipients: 1 }, options: { background: true } },
    { spec: { read: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
    { spec: { group: 1, sender: 1 }, options: { background: true } },
  ],

  /**
   * Referral indexes
   * Lookups: referrer/referee relationships, status tracking
   */
  referralIndexes: [
    { spec: { referrer: 1 }, options: { background: true } },
    { spec: { referee: 1 }, options: { background: true } },
    { spec: { status: 1 }, options: { background: true } },
    { spec: { createdAt: -1 }, options: { background: true } },
    { spec: { referrer: 1, status: 1 }, options: { background: true } },
  ],
};

/**
 * Initialize all database indexes
 * Should be called on application startup
 */
async function initializeIndexes() {
  try {
    const User = require('../models/User');
    const Group = require('../models/Group');
    const Loan = require('../models/Loan');
    const Contribution = require('../models/Contribution');
    const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
    const LoanEligibility = require('../models/LoanEligibility');
    const LoanAudit = require('../models/LoanAudit');
    const Chat = require('../models/Chat');

    console.log('🔍 Initializing database indexes...');

    // User indexes
    for (const { spec, options } of indexingStrategy.userIndexes) {
      await User.collection.createIndex(spec, options);
    }

    // Group indexes
    for (const { spec, options } of indexingStrategy.groupIndexes) {
      await Group.collection.createIndex(spec, options);
    }

    // Loan indexes
    for (const { spec, options } of indexingStrategy.loanIndexes) {
      await Loan.collection.createIndex(spec, options);
    }

    // Contribution indexes
    for (const { spec, options } of indexingStrategy.contributionIndexes) {
      await Contribution.collection.createIndex(spec, options);
    }

    // LoanRepaymentSchedule indexes
    for (const { spec, options } of indexingStrategy.repaymentScheduleIndexes) {
      await LoanRepaymentSchedule.collection.createIndex(spec, options);
    }

    // LoanEligibility indexes
    for (const { spec, options } of indexingStrategy.loanEligibilityIndexes) {
      await LoanEligibility.collection.createIndex(spec, options);
    }

    // LoanAudit indexes
    for (const { spec, options } of indexingStrategy.loanAuditIndexes) {
      await LoanAudit.collection.createIndex(spec, options);
    }

    // Chat indexes
    for (const { spec, options } of indexingStrategy.chatIndexes) {
      await Chat.collection.createIndex(spec, options);
    }

    console.log('✅ Database indexes initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing indexes:', error.message);
    throw error;
  }
}

/**
 * Query optimization helpers
 */
const queryOptimizations = {
  /**
   * Optimized user queries with lean()
   */
  getUserById: async (userId) => {
    const User = require('../models/User');
    return await User.findById(userId).lean();
  },

  /**
   * Batch user retrieval
   */
  getUsersByIds: async (userIds) => {
    const User = require('../models/User');
    return await User.find({ _id: { $in: userIds } }).lean();
  },

  /**
   * Optimized loan query with selective fields
   */
  getLoanWithSchedule: async (loanId) => {
    const Loan = require('../models/Loan');
    const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
    
    const [loan, schedule] = await Promise.all([
      Loan.findById(loanId)
        .select('user group amount status interestRate repaymentPeriodMonths createdAt')
        .lean(),
      LoanRepaymentSchedule.findOne({ loan: loanId }).lean(),
    ]);

    return { loan, schedule };
  },

  /**
   * Paginated query with sorting
   */
  getPaginatedResults: async (model, query, options = {}) => {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = -1,
      lean = true,
    } = options;

    const skip = (page - 1) * limit;
    const sortObj = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      lean
        ? model.find(query).sort(sortObj).skip(skip).limit(limit).lean()
        : model.find(query).sort(sortObj).skip(skip).limit(limit),
      model.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Aggregation pipeline for complex analytics
   */
  getGroupStatistics: async (groupId) => {
    const Loan = require('../models/Loan');
    const Contribution = require('../models/Contribution');

    const [loanStats, contributionStats] = await Promise.all([
      Loan.aggregate([
        { $match: { group: mongoose.Types.ObjectId(groupId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            averageAmount: { $avg: '$amount' },
          },
        },
      ]),
      Contribution.aggregate([
        { $match: { group: mongoose.Types.ObjectId(groupId) } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
            averageContribution: { $avg: '$amount' },
          },
        },
      ]),
    ]);

    return { loanStats, contributionStats };
  },
};

/**
 * Caching strategy with Redis (if available)
 */
const cachingStrategy = {
  // Cache TTL in seconds
  TTL: {
    USER: 3600, // 1 hour
    LOAN: 1800, // 30 minutes
    ELIGIBILITY: 1800, // 30 minutes (matches eligibility assessment validity)
    GROUP: 3600, // 1 hour
    ANALYTICS: 300, // 5 minutes
  },

  /**
   * Generate cache key
   */
  generateKey: (type, id, params = {}) => {
    const paramStr = Object.keys(params).length > 0
      ? `:${JSON.stringify(params)}`
      : '';
    return `${type}:${id}${paramStr}`;
  },

  /**
   * Cache invalidation patterns
   */
  invalidationPatterns: {
    userUpdate: (userId) => [`user:${userId}:*`],
    loanUpdate: (loanId) => [`loan:${loanId}:*`, `eligibility:*`],
    groupUpdate: (groupId) => [`group:${groupId}:*`],
    eligibilityUpdate: (userId, groupId) => [`eligibility:${userId}:${groupId}`],
  },
};

/**
 * Database connection pooling configuration
 */
const connectionPooling = {
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 45000,
  waitQueueTimeoutMS: 10000,
};

/**
 * Query timeout configuration (milliseconds)
 */
const queryTimeouts = {
  default: 30000, // 30 seconds
  aggregation: 60000, // 60 seconds
  transaction: 120000, // 2 minutes
  bulkOperation: 180000, // 3 minutes
};

module.exports = {
  indexingStrategy,
  initializeIndexes,
  queryOptimizations,
  cachingStrategy,
  connectionPooling,
  queryTimeouts,
};
