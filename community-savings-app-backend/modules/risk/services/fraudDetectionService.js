/**
 * ============================================================================
 * TITech Community Capital LTD
 * Fraud Detection Service
 * ============================================================================
 * Enterprise Fraud Monitoring Engine
 * Version: 2.0.0
 * ============================================================================
 */

const crypto = require("crypto");

class FraudDetectionService {
    constructor() {
        this.config = {
            thresholds: {
                LOW: 25,
                MEDIUM: 50,
                HIGH: 75,
                CRITICAL: 90
            },

            weights: {
                velocity: 20,
                geoRisk: 15,
                deviceRisk: 15,
                accountTakeover: 15,
                beneficiaryRisk: 10,
                behavioralRisk: 10,
                transactionPattern: 10,
                amlRisk: 5
            }
        };
    }

    /**
     * =========================================================================
     * MAIN ENTRY POINT
     * =========================================================================
     */
    async analyzeTransaction(transaction, member) {
        try {
            if (!transaction) {
                throw new Error("Transaction data is required");
            }

            const investigationId = crypto.randomUUID();

            const riskFactors = {
                velocityRisk: this.checkVelocityRisk(transaction, member),
                geoRisk: this.checkGeoRisk(transaction, member),
                deviceRisk: this.checkDeviceRisk(transaction, member),
                accountTakeoverRisk:
                    this.checkAccountTakeoverRisk(transaction, member),
                beneficiaryRisk:
                    this.checkBeneficiaryRisk(transaction),
                behavioralRisk:
                    this.checkBehaviouralRisk(transaction, member),
                transactionPatternRisk:
                    this.checkTransactionPatternRisk(
                        transaction,
                        member
                    ),
                amlRisk:
                    this.checkAMLRisk(transaction)
            };

            const fraudScore =
                this.calculateFraudScore(riskFactors);

            const fraudLevel =
                this.classifyRisk(fraudScore);

            const decision =
                this.generateDecision(
                    fraudScore,
                    fraudLevel
                );

            return {
                success: true,
                investigationId,
                timestamp: new Date().toISOString(),
                fraudScore,
                fraudLevel,
                decision,
                indicators: riskFactors,
                recommendations:
                    this.generateRecommendations(
                        fraudLevel,
                        riskFactors
                    )
            };
        } catch (error) {
            console.error(
                "Fraud Detection Error:",
                error
            );

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * =========================================================================
     * VELOCITY CHECK
     * =========================================================================
     */
    checkVelocityRisk(transaction, member) {
        const txLastHour =
            transaction.transactionsLastHour || 0;

        const txLastDay =
            transaction.transactionsLastDay || 0;

        let risk = 0;

        if (txLastHour > 5) {
            risk += 40;
        }

        if (txLastDay > 20) {
            risk += 60;
        }

        return Math.min(risk, 100);
    }

    /**
     * =========================================================================
     * GEO LOCATION ANOMALY
     * =========================================================================
     */
    checkGeoRisk(transaction, member) {
        if (!member || !member.country) {
            return 20;
        }

        if (
            transaction.country &&
            transaction.country !== member.country
        ) {
            return 70;
        }

        return 10;
    }

    /**
     * =========================================================================
     * DEVICE FINGERPRINT CHECK
     * =========================================================================
     */
    checkDeviceRisk(transaction, member) {
        if (
            !member ||
            !member.lastKnownDevice
        ) {
            return 20;
        }

        if (
            transaction.deviceId !==
            member.lastKnownDevice
        ) {
            return 75;
        }

        return 5;
    }

    /**
     * =========================================================================
     * ACCOUNT TAKEOVER DETECTION
     * =========================================================================
     */
    checkAccountTakeoverRisk(
        transaction,
        member
    ) {
        let risk = 0;

        if (transaction.passwordResetRecently) {
            risk += 30;
        }

        if (transaction.newDeviceLogin) {
            risk += 25;
        }

        if (transaction.newIPAddress) {
            risk += 20;
        }

        if (transaction.failedLogins > 3) {
            risk += 30;
        }

        return Math.min(risk, 100);
    }

    /**
     * =========================================================================
     * BENEFICIARY RISK
     * =========================================================================
     */
    checkBeneficiaryRisk(transaction) {
        let risk = 0;

        if (transaction.newBeneficiary) {
            risk += 40;
        }

        if (transaction.unverifiedBeneficiary) {
            risk += 30;
        }

        if (
            transaction.beneficiaryNameMismatch
        ) {
            risk += 20;
        }

        return Math.min(risk, 100);
    }

    /**
     * =========================================================================
     * BEHAVIOURAL ANALYSIS
     * =========================================================================
     */
    checkBehaviouralRisk(
        transaction,
        member
    ) {
        const averageTransaction =
            member?.averageTransactionAmount || 0;

        const amount =
            transaction.amount || 0;

        if (averageTransaction === 0) {
            return 10;
        }

        const ratio =
            amount / averageTransaction;

        if (ratio > 10) {
            return 90;
        }

        if (ratio > 5) {
            return 60;
        }

        if (ratio > 2) {
            return 30;
        }

        return 10;
    }

    /**
     * =========================================================================
     * TRANSACTION PATTERN ANALYSIS
     * =========================================================================
     */
    checkTransactionPatternRisk(
        transaction,
        member
    ) {
        let risk = 0;

        if (
            transaction.roundAmount &&
            transaction.amount >
                1000000
        ) {
            risk += 30;
        }

        if (
            transaction.highValueCashOut
        ) {
            risk += 40;
        }

        if (
            transaction.midnightTransaction
        ) {
            risk += 20;
        }

        return Math.min(risk, 100);
    }

    /**
     * =========================================================================
     * AML SCREENING
     * =========================================================================
     */
    checkAMLRisk(transaction) {
        let risk = 0;

        if (
            transaction.structuringDetected
        ) {
            risk += 50;
        }

        if (
            transaction.sanctionMatch
        ) {
            risk += 100;
        }

        if (
            transaction.pepMatch
        ) {
            risk += 40;
        }

        return Math.min(risk, 100);
    }

    /**
     * =========================================================================
     * FRAUD SCORE CALCULATION
     * =========================================================================
     */
    calculateFraudScore(risks) {
        const score =
            (risks.velocityRisk *
                this.config.weights.velocity +
                risks.geoRisk *
                    this.config.weights.geoRisk +
                risks.deviceRisk *
                    this.config.weights.deviceRisk +
                risks.accountTakeoverRisk *
                    this.config.weights
                        .accountTakeover +
                risks.beneficiaryRisk *
                    this.config.weights
                        .beneficiaryRisk +
                risks.behavioralRisk *
                    this.config.weights
                        .behavioralRisk +
                risks.transactionPatternRisk *
                    this.config.weights
                        .transactionPattern +
                risks.amlRisk *
                    this.config.weights
                        .amlRisk) /
            100;

        return Number(score.toFixed(2));
    }

    /**
     * =========================================================================
     * RISK CLASSIFICATION
     * =========================================================================
     */
    classifyRisk(score) {
        if (score >= 90) {
            return "CRITICAL";
        }

        if (score >= 75) {
            return "HIGH";
        }

        if (score >= 50) {
            return "MEDIUM";
        }

        return "LOW";
    }

    /**
     * =========================================================================
     * DECISION ENGINE
     * =========================================================================
     */
    generateDecision(score, level) {
        switch (level) {
            case "CRITICAL":
                return {
                    action: "BLOCK",
                    approved: false,
                    reviewRequired: true
                };

            case "HIGH":
                return {
                    action: "HOLD",
                    approved: false,
                    reviewRequired: true
                };

            case "MEDIUM":
                return {
                    action: "MONITOR",
                    approved: true,
                    reviewRequired: false
                };

            default:
                return {
                    action: "ALLOW",
                    approved: true,
                    reviewRequired: false
                };
        }
    }

    /**
     * =========================================================================
     * RECOMMENDATIONS
     * =========================================================================
     */
    generateRecommendations(level, risks) {
        const recommendations = [];

        if (risks.deviceRisk > 70) {
            recommendations.push(
                "Trigger device re-verification."
            );
        }

        if (
            risks.accountTakeoverRisk > 50
        ) {
            recommendations.push(
                "Require MFA authentication."
            );
        }

        if (risks.amlRisk > 50) {
            recommendations.push(
                "Escalate transaction to AML team."
            );
        }

        if (
            risks.beneficiaryRisk > 50
        ) {
            recommendations.push(
                "Verify beneficiary ownership."
            );
        }

        if (
            level === "CRITICAL"
        ) {
            recommendations.push(
                "Immediately freeze transaction."
            );

            recommendations.push(
                "Generate fraud investigation case."
            );
        }

        return recommendations;
    }

    /**
     * =========================================================================
     * FRAUD ALERT CREATION
     * =========================================================================
     */
    createFraudAlert(
        transactionId,
        fraudResult
    ) {
        return {
            alertId:
                crypto.randomUUID(),
            transactionId,
            severity:
                fraudResult.fraudLevel,
            fraudScore:
                fraudResult.fraudScore,
            createdAt:
                new Date().toISOString(),
            status: "OPEN"
        };
    }

    /**
     * =========================================================================
     * CASE MANAGEMENT
     * =========================================================================
     */
    createInvestigationCase(
        transaction,
        fraudResult
    ) {
        return {
            caseId:
                crypto.randomUUID(),
            transactionId:
                transaction.id,
            memberId:
                transaction.memberId,
            fraudScore:
                fraudResult.fraudScore,
            fraudLevel:
                fraudResult.fraudLevel,
            status: "PENDING_REVIEW",
            assignedTo: null,
            createdAt:
                new Date().toISOString()
        };
    }
}

module.exports =
    new FraudDetectionService();