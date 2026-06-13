// services/fraudDetectionService.js

const FraudLog = require('../models/FraudLog');

class FraudDetectionService {
  static async checkTransaction(user, transaction = {}) {
    let fraudScore = 0;

    // ✅ Safe defaults
    const {
      type,
      frequency = 0,
      rapidWithdrawals = false,
      newDevice = false,
      amount = 0,
      locationChange = false,
      locationMismatch = false,
      _id,
      id
    } = transaction;

    const transactionId = _id || id;
    const avgTransaction = user?.avgTransaction || 1;

    // ✅ RULES ENGINE (merged logic)

    // Legacy rules
    if (rapidWithdrawals) fraudScore += 0.4;
    if (newDevice && amount > 500000) fraudScore += 0.3;
    if (locationChange) fraudScore += 0.3;

    // New rules
    if (type === 'withdrawal' && frequency < 30) fraudScore += 0.4;
    if (newDevice && amount > 1000000) fraudScore += 0.5;
    if (locationMismatch) fraudScore += 0.3;

    // Behavioral anomaly
    if (amount > avgTransaction * 3) fraudScore += 0.2;
    if (amount > avgTransaction * 5) fraudScore += 0.3;

    // ✅ Clamp score
    fraudScore = Math.min(1, fraudScore);

    // ✅ Decision logic
    let decision = 'ALLOW';
    if (fraudScore > 0.8) decision = 'BLOCK';
    else if (fraudScore >= 0.5) decision = 'STEP_UP_AUTH';

    // ✅ Persist fraud log (multi-tenant safe)
    await FraudLog.create({
      userId: user._id,
      tenantId: user.tenantId,
      transactionId,
      fraudScore,
      decision,
      createdAt: new Date()
    });

    return { score: fraudScore, decision };
  }
}

module.exports = { FraudDetectionService };