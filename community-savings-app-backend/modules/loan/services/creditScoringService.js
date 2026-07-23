/**
 * ============================================================================
 * TITech Community Capital LTD
 * Loan Credit Scoring Service
 * ============================================================================
 * Enterprise Loan Credit Scoring Engine
 * ============================================================================
 * Features
 * - Loan applicant scoring
 * - Payment history evaluation
 * - Debt‑to‑income ratio analysis
 * - Loan utilization checks
 * - Account age & repayment consistency
 * - Fraud & sanctions integration
 * - Risk classification
 * - Recommendations engine
 * - Audit logging
 * ============================================================================
 */

const crypto = require("crypto");
const LoanRiskProfile = require("../../models/LoanRiskProfile");

class LoanCreditScoringService {
    constructor() {
        this.config = {
            weights: {
                PAYMENT_HISTORY: 35,
                DEBT_TO_INCOME: 25,
                LOAN_UTILIZATION: 20,
                ACCOUNT_AGE: 10,
                FRAUD_SANCTIONS: 10,
            },
            thresholds: {
                EXCELLENT: 750,
                GOOD: 650,
                FAIR: 550,
                POOR: 450,
                VERY_POOR: 300,
            },
        };
    }

    /**
     * =========================================================================
     * MAIN ENTRYPOINT
     * =========================================================================
     */
    async scoreApplicant(applicant, loanData, riskFlags = {}) {
        if (!applicant || !loanData) {
            throw new Error("Applicant and loan data required");
        }

        const scoreId = crypto.randomUUID();

        const score = this.calculateScore(loanData, riskFlags);
        const riskLevel = this.classifyRisk(score);

        // Persist loan risk profile
        await LoanRiskProfile.updateOne(
            { applicantId: applicant._id },
            {
                $set: {
                    applicantId: applicant._id,
                    tenantId: applicant.tenantId,
                    creditScore: score,
                    riskLevel,
                    loanData,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );

        return {
            scoreId,
            applicantId: applicant._id,
            tenantId: applicant.tenantId,
            creditScore: score,
            riskLevel,
            recommendations: this.generateRecommendations(riskLevel),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * CREDIT SCORING ENGINE
     * =========================================================================
     */
    calculateScore(loanData, riskFlags) {
        let score = 300; // base floor

        // Payment history
        const paymentFactor =
            (loanData.onTimePayments / (loanData.totalPayments || 1)) *
            this.config.weights.PAYMENT_HISTORY;
        score += paymentFactor * 10;

        // Debt‑to‑income ratio
        const dti = loanData.debt / (loanData.income || 1);
        const dtiFactor =
            (1 - Math.min(dti, 1)) * this.config.weights.DEBT_TO_INCOME;
        score += dtiFactor * 10;

        // Loan utilization
        const utilization =
            loanData.currentLoans / (loanData.loanLimit || 1);
        const utilizationFactor =
            (1 - Math.min(utilization, 1)) * this.config.weights.LOAN_UTILIZATION;
        score += utilizationFactor * 10;

        // Account age
        const ageMonths = loanData.accountAgeMonths || 0;
        const ageFactor =
            Math.min(ageMonths / 60, 1) * this.config.weights.ACCOUNT_AGE;
        score += ageFactor * 10;

        // Fraud / sanctions flags
        if (riskFlags.fraud || riskFlags.sanctions) {
            score -= this.config.weights.FRAUD_SANCTIONS * 10;
        }

        return Math.max(300, Math.min(850, Math.round(score)));
    }

    /**
     * =========================================================================
     * RISK CLASSIFICATION
     * =========================================================================
     */
    classifyRisk(score) {
        if (score >= this.config.thresholds.EXCELLENT) return "LOW";
        if (score >= this.config.thresholds.GOOD) return "MEDIUM";
        if (score >= this.config.thresholds.FAIR) return "HIGH";
        if (score >= this.config.thresholds.POOR) return "CRITICAL";
        return "SEVERE";
    }

    /**
     * =========================================================================
     * RECOMMENDATIONS ENGINE
     * =========================================================================
     */
    generateRecommendations(riskLevel) {
        switch (riskLevel) {
            case "LOW":
                return ["Loan approval recommended", "Eligible for premium loan products"];
            case "MEDIUM":
                return ["Loan approval possible with caution", "Consider moderate loan limits"];
            case "HIGH":
                return ["Loan approval risky", "Require collateral or guarantor"];
            case "CRITICAL":
                return ["Loan approval unlikely", "Suggest debt restructuring"];
            case "SEVERE":
                return ["Block loan application", "Escalate to compliance team"];
            default:
                return ["No recommendations available"];
        }
    }
}

module.exports = new LoanCreditScoringService();
