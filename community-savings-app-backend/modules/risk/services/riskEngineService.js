/**
 * ============================================================================
 * TITech Community Capital LTD
 * Risk Engine Service
 * ============================================================================
 * Production Grade Risk Assessment Engine
 * Version: 2.0.0
 * ============================================================================
 */

const crypto = require("crypto");

class RiskEngineService {
    constructor() {
        this.config = {
            riskBands: {
                LOW: { min: 0, max: 29 },
                MEDIUM: { min: 30, max: 59 },
                HIGH: { min: 60, max: 79 },
                CRITICAL: { min: 80, max: 100 }
            },

            weights: {
                creditHistory: 25,
                repaymentBehaviour: 20,
                indebtedness: 15,
                savingsPattern: 10,
                kycCompliance: 10,
                fraudIndicators: 10,
                transactionBehaviour: 10
            }
        };
    }

    /**
     * Main Risk Assessment Entry Point
     */
    async assessMemberRisk(member) {
        try {
            if (!member) {
                throw new Error("Member data is required");
            }

            const assessmentId = crypto.randomUUID();

            const scores = {
                creditHistory: this.evaluateCreditHistory(member),
                repaymentBehaviour: this.evaluateRepaymentBehaviour(member),
                indebtedness: this.evaluateIndebtedness(member),
                savingsPattern: this.evaluateSavingsPattern(member),
                kycCompliance: this.evaluateKYCCompliance(member),
                fraudIndicators: this.evaluateFraudRisk(member),
                transactionBehaviour:
                    this.evaluateTransactionBehaviour(member)
            };

            const totalRiskScore =
                (scores.creditHistory *
                    this.config.weights.creditHistory +
                    scores.repaymentBehaviour *
                        this.config.weights.repaymentBehaviour +
                    scores.indebtedness *
                        this.config.weights.indebtedness +
                    scores.savingsPattern *
                        this.config.weights.savingsPattern +
                    scores.kycCompliance *
                        this.config.weights.kycCompliance +
                    scores.fraudIndicators *
                        this.config.weights.fraudIndicators +
                    scores.transactionBehaviour *
                        this.config.weights.transactionBehaviour) /
                100;

            const classification =
                this.classifyRisk(totalRiskScore);

            const recommendations =
                this.generateRecommendations(
                    classification,
                    scores
                );

            return {
                success: true,
                assessmentId,
                timestamp: new Date().toISOString(),
                riskScore: Number(totalRiskScore.toFixed(2)),
                classification,
                componentScores: scores,
                recommendations
            };
        } catch (error) {
            console.error("Risk Assessment Error:", error);

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Credit History Score
     */
    evaluateCreditHistory(member) {
        if (!member.creditHistory) return 80;

        const defaults =
            member.creditHistory.defaults || 0;

        const latePayments =
            member.creditHistory.latePayments || 0;

        let score = 0;

        score += defaults * 25;
        score += latePayments * 4;

        return Math.min(score, 100);
    }

    /**
     * Loan Repayment Behaviour
     */
    evaluateRepaymentBehaviour(member) {
        const repaymentRate =
            member.repaymentRate || 100;

        if (repaymentRate >= 95) return 10;
        if (repaymentRate >= 85) return 30;
        if (repaymentRate >= 70) return 60;

        return 90;
    }

    /**
     * Debt Exposure Analysis
     */
    evaluateIndebtedness(member) {
        const monthlyIncome =
            member.monthlyIncome || 1;

        const activeDebt =
            member.activeDebt || 0;

        const ratio =
            (activeDebt / monthlyIncome) * 100;

        if (ratio < 30) return 10;
        if (ratio < 50) return 30;
        if (ratio < 70) return 60;

        return 90;
    }

    /**
     * Savings Behaviour
     */
    evaluateSavingsPattern(member) {
        const consistency =
            member.savingsConsistency || 0;

        if (consistency >= 90) return 10;
        if (consistency >= 70) return 30;
        if (consistency >= 50) return 60;

        return 85;
    }

    /**
     * KYC / AML Compliance
     */
    evaluateKYCCompliance(member) {
        let score = 0;

        if (!member.kycVerified) score += 30;
        if (!member.nationalIdVerified) score += 20;
        if (!member.addressVerified) score += 15;
        if (!member.selfieVerified) score += 15;
        if (member.pepFlag) score += 20;

        return Math.min(score, 100);
    }

    /**
     * Fraud Detection Signals
     */
    evaluateFraudRisk(member) {
        let score = 0;

        if (member.deviceMismatch) score += 20;
        if (member.multipleAccounts) score += 25;
        if (member.suspectedIdentityFraud) score += 40;
        if (member.velocityViolation) score += 15;
        if (member.beneficiaryMismatch) score += 10;

        return Math.min(score, 100);
    }

    /**
     * Transaction Behaviour Analysis
     */
    evaluateTransactionBehaviour(member) {
        const suspiciousTransactions =
            member.suspiciousTransactions || 0;

        const chargebacks =
            member.chargebacks || 0;

        let score = 0;

        score += suspiciousTransactions * 8;
        score += chargebacks * 10;

        return Math.min(score, 100);
    }

    /**
     * Risk Classification
     */
    classifyRisk(score) {
        if (score <= 29) {
            return "LOW";
        }

        if (score <= 59) {
            return "MEDIUM";
        }

        if (score <= 79) {
            return "HIGH";
        }

        return "CRITICAL";
    }

    /**
     * Risk Recommendations
     */
    generateRecommendations(category, scores) {
        const recommendations = [];

        switch (category) {
            case "LOW":
                recommendations.push(
                    "Eligible for standard lending products."
                );
                break;

            case "MEDIUM":
                recommendations.push(
                    "Consider reduced loan limit."
                );
                recommendations.push(
                    "Increase monitoring frequency."
                );
                break;

            case "HIGH":
                recommendations.push(
                    "Require guarantors."
                );
                recommendations.push(
                    "Manual credit committee review."
                );
                recommendations.push(
                    "Enable transaction monitoring."
                );
                break;

            case "CRITICAL":
                recommendations.push(
                    "Reject automated approval."
                );
                recommendations.push(
                    "Escalate to Risk & Compliance team."
                );
                recommendations.push(
                    "Conduct enhanced due diligence."
                );
                break;
        }

        if (scores.fraudIndicators > 50) {
            recommendations.push(
                "Fraud review required."
            );
        }

        if (scores.kycCompliance > 50) {
            recommendations.push(
                "Complete pending KYC verification."
            );
        }

        return recommendations;
    }

    /**
     * Loan Decisioning Engine
     */
    async evaluateLoanEligibility(member, loanAmount) {
        const risk = await this.assessMemberRisk(member);

        if (!risk.success) {
            return risk;
        }

        const decision = {
            approved: false,
            maxEligibleAmount: 0,
            reason: []
        };

        switch (risk.classification) {
            case "LOW":
                decision.approved = true;
                decision.maxEligibleAmount =
                    loanAmount * 1.0;
                break;

            case "MEDIUM":
                decision.approved = true;
                decision.maxEligibleAmount =
                    loanAmount * 0.75;
                decision.reason.push(
                    "Moderate risk profile"
                );
                break;

            case "HIGH":
                decision.approved = false;
                decision.reason.push(
                    "Manual credit review required"
                );
                break;

            case "CRITICAL":
                decision.approved = false;
                decision.reason.push(
                    "Risk profile exceeds lending threshold"
                );
                break;
        }

        return {
            ...risk,
            loanDecision: decision
        };
    }
}

module.exports = new RiskEngineService();