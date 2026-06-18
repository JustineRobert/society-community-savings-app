// services/fraudDetectionService.js
"use strict";

const FraudLog = require("../models/FraudLog");

/**
 * Fraud detection service
 * Evaluates a transaction using simple rules + AI simulation
 * Persists fraud log entry for audit trail
 */
exports.checkFraud = async (transaction) => {
  let score = 0;

  // ✅ RULES ENGINE
  if (transaction.amount > 5000000) score += 0.3;
  if (transaction.isNewDevice) score += 0.3;
  if (transaction.quickRepeat) score += 0.4;

  // ✅ AI SIMULATION
  if (transaction.userPatternDeviation > 0.7) score += 0.5;

  // ✅ Decision logic
  let decision = "ALLOW";
  if (score > 0.8) decision = "BLOCK";
  else if (score > 0.5) decision = "REVIEW";

  // ✅ Persist fraud log (multi-tenant safe)
  await FraudLog.create({
    userId: transaction.userId,
    tenantId: transaction.tenantId,
    transactionId: transaction.id,
    fraudScore: score,
    decision,
  });

  return { score, decision };
};
