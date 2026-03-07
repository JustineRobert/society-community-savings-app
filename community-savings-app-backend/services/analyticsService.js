const EventEmitter = require('events');
const logger = require('../middleware/logging');

class AnalyticsService extends EventEmitter {
  constructor() {
    super();
    this.events = [];
  }

  // Track event
  trackEvent(eventType, userId, data = {}) {
    const event = {
      type: eventType,
      userId,
      data,
      timestamp: new Date(),
      ip: data.ip
    };
    this.events.push(event);
    this.emit('event', event);
    logger.info(`Analytics event: ${eventType}`, { userId, data });
  }

  // Aggregation methods for admin dashboard
  async getPaymentMetrics(from, to) {
    const Transaction = require('../models/Transaction');
    return Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, failures: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }
    ]);
  }

  async getUserMetrics(days = 30) {
    const User = require('../models/User');
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);
    return User.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: null, new: { $sum: 1 }, verified: { $sum: { $cond: ['$verified', 1, 0] } } } }
    ]);
  }

  async getLoanMetrics() {
    const Loan = require('../models/Loan');
    return Loan.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amountApproved' } } }
    ]);
  }

  async getReferralMetrics() {
    const Referral = require('../models/Referral');
    return Referral.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, redeemed: { $sum: { $cond: ['$used', 1, 0] } }, conversionRate: { $avg: { $cond: ['$used', 1, 0] } } } }
    ]);
  }
}

module.exports = new AnalyticsService();
