const mongoose = require('mongoose');

/**
 * Referral Schema
 * Tracks user-to-user referrals
 */
const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One referral per user
  },
  referralCode: {
    type: String,
    required: true,
  },
  rewardIssued: {
    type: Boolean,
    default: false,
  },
  issuedAt: {
    type: Date,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);
