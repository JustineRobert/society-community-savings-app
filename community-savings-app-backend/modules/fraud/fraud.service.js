// backend/modules/risk/risk.service.js
"use strict";

const logger = require("../utils/logger") || console;

// ✅ Configurable thresholds (can be tuned per tenant or environment)
const RISK_RULES = {
  LARGE_TX_AMOUNT: 1_000_000,
  NEW_ACCOUNT_MINUTES: 60,
  HIGH_TX_COUNT: 5,
};

function calculateRiskScore({ amount = 0, userAgeMinutes = 0, transactionCount = 0, locationMismatch = false }) {
  let score = 0;

  // ✅ Rule 1: Large transaction
  if (amount > RISK_RULES.LARGE_TX_AMOUNT) {
    score += 30;
    logger.debug("[RiskService] Large transaction flagged", { amount });
  }

  // ✅ Rule 2: New account risk
  if (userAgeMinutes < RISK_RULES.NEW_ACCOUNT_MINUTES) {
    score += 25;
    logger.debug("[RiskService] New account flagged", { userAgeMinutes });
  }

  // ✅ Rule 3: Velocity (many transactions)
  if (transactionCount > RISK_RULES.HIGH_TX_COUNT) {
    score += 20;
    logger.debug("[RiskService] High transaction velocity flagged", { transactionCount });
  }

  // ✅ Rule 4: Location anomaly
  if (locationMismatch) {
    score += 25;
    logger.debug("[RiskService] Location mismatch flagged");
  }

  return score;
}

function getDecision(score) {
  if (score < 40) return "APPROVE";
  if (score < 80) return "REVIEW";
  return "BLOCK";
}

function evaluateTransaction(data) {
  try {
    const score = calculateRiskScore(data);
    const decision = getDecision(score);

    logger.info("[RiskService] Transaction evaluated", {
      tenantId: data.tenantId,
      amount: data.amount,
      score,
      decision,
    });

    return { score, decision };
  } catch (error) {
    logger.error("[RiskService] Evaluation error", {
      error: error.message,
      data,
    });
    throw error;
  }
}

module.exports = {
  evaluateTransaction,
  calculateRiskScore,
  getDecision,
};
