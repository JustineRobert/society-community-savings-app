/**
 * ============================================================================
 * TITech Community Capital LTD
 * Credit Scoring Service
 * ============================================================================
 * Enterprise Credit Scoring Engine
 * ============================================================================
 * Features
 * - Multi‑factor credit scoring
 * - Payment history evaluation
 * - Debt‑to‑income ratio analysis
 * - Loan utilization checks
 * - Sanctions & fraud integration
 * - Risk classification
 * - Recommendations engine
 * - Audit logging
 * ============================================================================
 */

const crypto = require("crypto");
const RiskProfile = require("../../models/RiskProfile");

class CreditScoringService {
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
    async scoreCustomer(user, financialData, riskFlags = {}) {
        if (!user || !financialData) {
            throw new Error("User and financial data required");
        }

        const scoreId = crypto.randomUUID();

        const score = this.calculateScore(financialData, riskFlags);
        const riskLevel = this.classifyRisk(score);

        // Persist risk profile
        await RiskProfile.updateOne(
            { userId: user._id },
            {
                $set: {
                    userId: user._id,
                    tenantId: user.tenantId,
                    creditScore: score,
                    riskLevel,
                    financialData,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );

        return {
            scoreId,
            userId: user._id,
            tenantId: user.tenantId,
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
    calculateScore(financialData, riskFlags) {
        let score = 300; // base floor

        // Payment history
        const paymentFactor =
            (financialData.onTimePayments / (financialData.totalPayments || 1)) *
            this.config.weights.PAYMENT_HISTORY;
        score += paymentFactor * 10;

        // Debt‑to‑income ratio
        const dti = financialData.debt / (financialData.income || 1);
        const dtiFactor =
            (1 - Math.min(dti, 1)) * this.config.weights.DEBT_TO_INCOME;
        score += dtiFactor * 10;

        // Loan utilization
        const utilization =
            financialData.currentLoans / (financialData.loanLimit || 1);
        const utilizationFactor =
            (1 - Math.min(utilization, 1)) * this.config.weights.LOAN_UTILIZATION;
        score += utilizationFactor * 10;

        // Account age
        const ageMonths = financialData.accountAgeMonths || 0;
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
                return ["Eligible for premium credit products", "Maintain good payment history"];
            case "MEDIUM":
                return ["Eligible for standard credit products", "Reduce debt‑to‑income ratio"];
            case "HIGH":
                return ["Limited credit eligibility", "Improve repayment consistency"];
            case "CRITICAL":
                return ["Credit approval unlikely", "Debt restructuring recommended"];
            case "SEVERE":
                return ["Block credit applications", "Escalate to compliance team"];
            default:
                return ["No recommendations available"];
        }
    }
}

module.exports = new CreditScoringService();