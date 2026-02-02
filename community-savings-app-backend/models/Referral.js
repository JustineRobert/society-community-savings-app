/**
 * Referral Model - ENHANCED
 * 
 * Tracks referrals with rewards, anti-abuse measures, and fraud detection
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const referralSchema = new mongoose.Schema(
  {
    // Referrer (who created the referral)
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Referrer is required'],
      index: true,
    },

    // Referee (who was referred)
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Referee is required'],
      unique: true, // One referral per user
      index: true,
    },

    // Unique referral code (user-specific for tracking)
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Status of referral
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired', 'fraudulent'],
      default: 'pending',
    },

    // Completion tracking
    completedAt: {
      type: Date,
      default: null,
    },

    // Rewards
    rewardAmount: {
      type: Number,
      default: 0,
    },

    rewardType: {
      type: String,
      enum: ['bonus_credit', 'cash', 'points', 'savings_boost'],
      default: 'bonus_credit',
    },

    rewardIssued: {
      type: Boolean,
      default: false,
    },

    rewardIssuedAt: {
      type: Date,
      default: null,
    },

    // Anti-abuse/fraud detection
    fraud: {
      isFlagged: {
        type: Boolean,
        default: false,
      },
      flagReason: String,
      flaggedAt: Date,
      flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },

      // Device fingerprinting
      referrerDeviceHash: String,
      refereeDeviceHash: String,
      sameDeviceDetected: {
        type: Boolean,
        default: false,
      },

      // IP detection
      referrerIP: String,
      refereeIP: String,
      sameIPDetected: {
        type: Boolean,
        default: false,
      },

      // Similar patterns
      referrerEmail: String,
      refereeEmail: String,
      suspiciousEmailPattern: Boolean,

      // Timing analysis
      timeBetweenSignups: Number, // milliseconds
      suspiciousTiming: Boolean,
    },

    // Verification
    emailVerified: {
      type: Boolean,
      default: false,
    },

    firstContributionAt: {
      type: Date,
      default: null,
    },

    // Metadata
    metadata: {
      referrerUserAgent: String,
      refereeUserAgent: String,
      referralSource: String, // where the code was shared
      campaignId: String, // for marketing campaigns
    },

    // Expiry (referrals expire if not completed within timeframe)
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = doc._id.toString();
        delete ret._id;
      },
    },
  }
);

// Indices
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referee: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1, expiresAt: 1 });
referralSchema.index({ 'fraud.isFlagged': 1 });

/**
 * Generate unique referral code
 */
referralSchema.statics.generateReferralCode = function (referrerId) {
  const randomPart = crypto.randomBytes(8).toString('hex').toUpperCase();
  const timestampPart = Date.now().toString(36).toUpperCase();
  return `REF-${randomPart}-${timestampPart}`;
};

/**
 * Detect fraud signals
 */
referralSchema.methods.detectFraud = async function () {
  let suspiciousFactors = [];

  // Same device detection
  if (
    this.fraud.referrerDeviceHash &&
    this.fraud.refereeDeviceHash &&
    this.fraud.referrerDeviceHash === this.fraud.refereeDeviceHash
  ) {
    this.fraud.sameDeviceDetected = true;
    suspiciousFactors.push('same_device');
  }

  // Same IP detection
  if (
    this.fraud.referrerIP &&
    this.fraud.refereeIP &&
    this.fraud.referrerIP === this.fraud.refereeIP
  ) {
    this.fraud.sameIPDetected = true;
    suspiciousFactors.push('same_ip');
  }

  // Suspicious email patterns
  if (this.fraud.referrerEmail && this.fraud.refereeEmail) {
    const referrerDomain = this.fraud.referrerEmail.split('@')[1];
    const refereeDomain = this.fraud.refereeEmail.split('@')[1];

    if (referrerDomain === refereeDomain) {
      this.fraud.suspiciousEmailPattern = true;
      suspiciousFactors.push('same_email_domain');
    }
  }

  // Suspicious timing (referral completed within minutes)
  if (this.fraud.timeBetweenSignups && this.fraud.timeBetweenSignups < 5 * 60 * 1000) {
    this.fraud.suspiciousTiming = true;
    suspiciousFactors.push('suspicious_timing');
  }

  // Flag if multiple suspicious factors
  if (suspiciousFactors.length >= 2) {
    this.fraud.isFlagged = true;
    this.fraud.flagReason = `Multiple fraud signals: ${suspiciousFactors.join(', ')}`;
    this.status = 'fraudulent';
  }

  return suspiciousFactors;
};

/**
 * Mark referral as completed
 */
referralSchema.methods.markCompleted = async function () {
  this.status = 'completed';
  this.completedAt = new Date();
  await this.save();
  return this;
};

/**
 * Issue reward
 */
referralSchema.methods.issueReward = async function () {
  if (this.rewardIssued) {
    throw new Error('Reward already issued');
  }

  if (this.status !== 'completed') {
    throw new Error('Referral must be completed before issuing reward');
  }

  this.rewardIssued = true;
  this.rewardIssuedAt = new Date();
  await this.save();
  return this;
};

/**
 * Get pending referrals for user
 */
referralSchema.statics.getPendingForUser = function (referrerId) {
  return this.find({
    referrer: referrerId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('referee', 'name email isVerified')
    .sort({ createdAt: -1 });
};

/**
 * Get completed referrals with rewards
 */
referralSchema.statics.getCompletedForUser = function (referrerId) {
  return this.find({
    referrer: referrerId,
    status: 'completed',
    rewardIssued: true,
  })
    .populate('referee', 'name email')
    .sort({ rewardIssuedAt: -1 });
};

/**
 * Calculate user's total referral rewards
 */
referralSchema.statics.calculateUserRewards = async function (referrerId) {
  const result = await this.aggregate([
    {
      $match: {
        referrer: mongoose.Types.ObjectId(referrerId),
        status: 'completed',
        rewardIssued: true,
      },
    },
    {
      $group: {
        _id: null,
        totalRewards: { $sum: '$rewardAmount' },
        completedCount: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalRewards: 0, completedCount: 0 };
};

module.exports = mongoose.model('Referral', referralSchema);
