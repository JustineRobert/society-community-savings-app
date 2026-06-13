// services/creditScoringService.js

const RiskProfile = require('../models/RiskProfile');
const FraudLog = require('../models/FraudLog');

/**
 * CREDIT SCORING SERVICE
 */
const calculateCreditScore = async (user, financials = {}) => {
  let score = 0;

  // ✅ Safe defaults
  const {
    savingsFrequency = 0,
    depositConsistency = 0,
    repaymentRate = 0,
    missedPayments = 0,
    momoInflows = 0,
    spendingVolatility = 0,
    groupParticipation = 0,
    guarantorStrength = 0
  } = financials;

  // ✅ Behavioral
  score += savingsFrequency * 40;
  score += depositConsistency * 100;

  // ✅ Loan performance
  score += repaymentRate * 300;
  score -= missedPayments * 120;

  // ✅ Transactional (MoMo)
  score += momoInflows * 0.01;
  score -= spendingVolatility * 50;

  // ✅ SACCO social
  score += groupParticipation * 80;
  score += guarantorStrength * 100;

  // ✅ Clamp score
  score = Math.max(0, Math.min(1000, score));

  // ✅ Decision logic
  let decision = "REJECT";
  if (score > 650) decision = "APPROVE";
  else if (score > 400) decision = "REVIEW";

  // ✅ Persist risk profile (multi-tenant safe)
  await RiskProfile.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      tenantId: user.tenantId,
      creditScore: score,
      riskLevel: decision,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  return { score, decision };
};


/**
 * FRAUD DETECTION SERVICE
 */
class FraudDetectionService {
  static async checkTransaction(user, transaction) {
    let fraudScore = 0;

    // ✅ Safe defaults
    const {
      type,
      frequency = 0,
      newDevice = false,
      amount = 0,
      locationMismatch = false,
      _id: transactionId
    } = transaction;

    const avgTransaction = user?.avgTransaction || 1;

    // ✅ Rules Engine
    if (type === 'withdrawal' && frequency < 30) fraudScore += 0.4;
    if (newDevice && amount > 1000000) fraudScore += 0.5;
    if (locationMismatch) fraudScore += 0.3;

    if (amount > avgTransaction * 5) fraudScore += 0.3;

    // ✅ Normalize
    fraudScore = Math.min(1, fraudScore);

    // ✅ Decision logic
    let decision = 'ALLOW';
    if (fraudScore > 0.8) decision = 'BLOCK';
    else if (fraudScore >= 0.5) decision = 'STEP_UP';

    // ✅ Log fraud event (tenant-safe)
    await FraudLog.create({
      userId: user._id,
      tenantId: user.tenantId,
      transactionId,
      fraudScore,
      decision,
      createdAt: new Date()
    });

    return { fraudScore, decision };
  }
}


/**
 * EXPORTS
 */
module.exports = {
  calculateCreditScore,
  FraudDetectionService
};