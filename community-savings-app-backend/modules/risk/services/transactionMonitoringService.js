/**
 * ============================================================================
 * TITech Community Capital LTD
 * Transaction Monitoring Service
 * ============================================================================
 * Enterprise Transaction Monitoring Engine
 * ============================================================================
 * Features
 * - Real‑time monitoring
 * - Rule‑based detection
 * - Velocity checks
 * - Geolocation anomaly detection
 * - Device fingerprint checks
 * - Risk scoring
 * - Alert generation
 * - Audit logging
 * ============================================================================
 */

const crypto = require("crypto");
const RiskAlert = require("../../models/RiskAlert");
const TransactionLog = require("../../models/TransactionLog");

class TransactionMonitoringService {
    constructor() {
        this.config = {
            thresholds: {
                BLOCK: 80,
                REVIEW: 50,
                APPROVE: 0
            },
            rules: {
                LARGE_AMOUNT: 1000000,
                VELOCITY_LIMIT: 5,
                NEW_ACCOUNT_AGE_MINUTES: 60
            }
        };
    }

    /**
     * =========================================================================
     * MAIN ENTRYPOINT
     * =========================================================================
     */
    async monitorTransaction(user, transaction) {
        if (!user || !transaction) {
            throw new Error("User and transaction data required");
        }

        const monitoringId = crypto.randomUUID();

        const riskScore = this.calculateRiskScore({
            amount: transaction.amount,
            userAgeMinutes: this.getUserAgeMinutes(user),
            transactionCount: user.transactionCount || 0,
            locationMismatch: transaction.locationMismatch || false,
            newDevice: transaction.newDevice || false
        });

        const decision = this.getDecision(riskScore);

        // Persist transaction log
        await TransactionLog.create({
            monitoringId,
            userId: user._id,
            tenantId: user.tenantId,
            transactionId: transaction._id,
            riskScore,
            decision,
            createdAt: new Date()
        });

        // Generate alert if needed
        if (decision !== "APPROVE") {
            await this.generateAlert(user, transaction, riskScore, decision);
        }

        return {
            monitoringId,
            riskScore,
            decision,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * =========================================================================
     * RISK SCORING ENGINE
     * =========================================================================
     */
    calculateRiskScore({ amount, userAgeMinutes, transactionCount, locationMismatch, newDevice }) {
        let score = 0;

        // Rule 1: Large transaction
        if (amount > this.config.rules.LARGE_AMOUNT) score += 30;

        // Rule 2: New account risk
        if (userAgeMinutes < this.config.rules.NEW_ACCOUNT_AGE_MINUTES) score += 25;

        // Rule 3: Velocity (many transactions)
        if (transactionCount > this.config.rules.VELOCITY_LIMIT) score += 20;

        // Rule 4: Location anomaly
        if (locationMismatch) score += 15;

        // Rule 5: New device anomaly
        if (newDevice) score += 10;

        return score;
    }

    /**
     * =========================================================================
     * DECISION ENGINE
     * =========================================================================
     */
    getDecision(score) {
        if (score >= this.config.thresholds.BLOCK) return "BLOCK";
        if (score >= this.config.thresholds.REVIEW) return "REVIEW";
        return "APPROVE";
    }

    /**
     * =========================================================================
     * ALERT GENERATION
     * =========================================================================
     */
    async generateAlert(user, transaction, riskScore, decision) {
        return RiskAlert.create({
            alertId: crypto.randomUUID(),
            userId: user._id,
            tenantId: user.tenantId,
            transactionId: transaction._id,
            riskScore,
            decision,
            status: "OPEN",
            createdAt: new Date()
        });
    }

    /**
     * =========================================================================
     * UTILITIES
     * =========================================================================
     */
    getUserAgeMinutes(user) {
        if (!user.createdAt) return Infinity;
        const diffMs = Date.now() - new Date(user.createdAt).getTime();
        return Math.floor(diffMs / 60000);
    }
}

module.exports = new TransactionMonitoringService();
