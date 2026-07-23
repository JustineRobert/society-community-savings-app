/**
 * ============================================================================
 * TITech Community Capital LTD
 * Behavioral Analysis Service
 * ============================================================================
 * Enterprise Behavioral Analytics Engine
 * ============================================================================
 * Features
 * - User behavioral profiling
 * - Session anomaly detection
 * - Transaction pattern analysis
 * - Login behavior monitoring
 * - Device & channel usage analysis
 * - Risk scoring
 * - Alert generation
 * - Audit logging
 * ============================================================================
 */

const crypto = require("crypto");
const RiskAlert = require("../../models/RiskAlert");
const BehavioralProfile = require("../../models/BehavioralProfile");

class BehavioralAnalysisService {
    constructor() {
        this.config = {
            thresholds: {
                BLOCK: 80,
                REVIEW: 50,
                APPROVE: 0,
            },
            weights: {
                LOGIN_ANOMALY: 25,
                TRANSACTION_PATTERN: 30,
                DEVICE_CHANGE: 20,
                CHANNEL_DEVIATION: 15,
                SESSION_DURATION: 10,
            },
        };
    }

    /**
     * =========================================================================
     * MAIN ENTRYPOINT
     * =========================================================================
     */
    async analyzeBehavior(user, sessionData) {
        if (!user || !sessionData) {
            throw new Error("User and session data required");
        }

        const analysisId = crypto.randomUUID();

        const riskScore = this.calculateRiskScore(user, sessionData);
        const decision = this.getDecision(riskScore);

        // Persist behavioral profile
        await BehavioralProfile.updateOne(
            { userId: user._id },
            {
                $set: {
                    userId: user._id,
                    tenantId: user.tenantId,
                    lastSession: sessionData,
                    lastScore: riskScore,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );

        // Generate alert if needed
        if (decision !== "APPROVE") {
            await this.generateAlert(user, riskScore, decision, sessionData);
        }

        return {
            analysisId,
            riskScore,
            decision,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * RISK SCORING ENGINE
     * =========================================================================
     */
    calculateRiskScore(user, sessionData) {
        let score = 0;

        // Rule 1: Login anomaly (e.g., unusual time or location)
        if (sessionData.loginAnomaly) {
            score += this.config.weights.LOGIN_ANOMALY;
        }

        // Rule 2: Transaction pattern deviation
        if (sessionData.transactionDeviation) {
            score += this.config.weights.TRANSACTION_PATTERN;
        }

        // Rule 3: Device change
        if (sessionData.newDevice) {
            score += this.config.weights.DEVICE_CHANGE;
        }

        // Rule 4: Channel deviation (e.g., switching from mobile to web unexpectedly)
        if (sessionData.channelDeviation) {
            score += this.config.weights.CHANNEL_DEVIATION;
        }

        // Rule 5: Abnormal session duration
        if (sessionData.abnormalDuration) {
            score += this.config.weights.SESSION_DURATION;
        }

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
    async generateAlert(user, riskScore, decision, sessionData) {
        return RiskAlert.create({
            alertId: crypto.randomUUID(),
            userId: user._id,
            tenantId: user.tenantId,
            riskScore,
            decision,
            sessionData,
            status: "OPEN",
            createdAt: new Date(),
        });
    }
}

module.exports = new BehavioralAnalysisService();
