/**
 * ============================================================================
 * TITech Community Capital LTD
 * AML Screening Service
 * ============================================================================
 * Anti-Money Laundering (AML)
 * Counter Terrorism Financing (CFT)
 * Risk Monitoring Engine
 * ============================================================================
 */

const crypto = require("crypto");

class AMLScreeningService {
    constructor() {
        this.config = {
            thresholds: {
                LOW: 30,
                MEDIUM: 60,
                HIGH: 80,
                CRITICAL: 90
            },

            weights: {
                sanctions: 30,
                pep: 15,
                adverseMedia: 10,
                geography: 10,
                customerProfile: 10,
                structuring: 10,
                transactionMonitoring: 10,
                suspiciousBehaviour: 5
            }
        };
    }

    /**
     * =========================================================================
     * MAIN AML SCREENING ENTRYPOINT
     * =========================================================================
     */
    async screenTransaction(transaction, customer) {
        try {
            if (!transaction) {
                throw new Error("Transaction required");
            }

            const screeningId = crypto.randomUUID();

            const results = {
                sanctionsRisk:
                    this.screenSanctions(customer),

                pepRisk:
                    this.screenPEP(customer),

                adverseMediaRisk:
                    this.screenAdverseMedia(customer),

                geographyRisk:
                    this.evaluateGeographicRisk(
                        transaction,
                        customer
                    ),

                customerRisk:
                    this.evaluateCustomerRisk(
                        customer
                    ),

                structuringRisk:
                    this.detectStructuring(
                        transaction
                    ),

                monitoringRisk:
                    this.monitorTransaction(
                        transaction
                    ),

                suspiciousBehaviourRisk:
                    this.analyzeSuspiciousBehaviour(
                        transaction,
                        customer
                    )
            };

            const amlScore =
                this.calculateAMLScore(results);

            const riskLevel =
                this.classifyRisk(
                    amlScore
                );

            const decision =
                this.generateDecision(
                    amlScore,
                    riskLevel
                );

            return {
                success: true,
                screeningId,
                timestamp:
                    new Date().toISOString(),
                amlScore,
                riskLevel,
                decision,
                indicators: results,
                recommendations:
                    this.generateRecommendations(
                        riskLevel,
                        results
                    )
            };
        } catch (error) {
            console.error(
                "AML Screening Error:",
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
     * SANCTIONS SCREENING
     * =========================================================================
     * Future Integration:
     * OFAC
     * UN
     * EU
     * UK HMT
     * Local Regulatory Lists
     * =========================================================================
     */
    screenSanctions(customer) {
        if (!customer) {
            return 30;
        }

        if (
            customer.sanctionMatch === true
        ) {
            return 100;
        }

        return 0;
    }

    /**
     * =========================================================================
     * PEP SCREENING
     * =========================================================================
     */
    screenPEP(customer) {
        if (!customer) {
            return 10;
        }

        if (customer.pepMatch) {
            return 80;
        }

        if (customer.relatedToPEP) {
            return 60;
        }

        return 0;
    }

    /**
     * =========================================================================
     * ADVERSE MEDIA
     * =========================================================================
     */
    screenAdverseMedia(customer) {
        if (!customer) {
            return 10;
        }

        if (
            customer.adverseMediaHit
        ) {
            return 75;
        }

        return 0;
    }

    /**
     * =========================================================================
     * HIGH-RISK JURISDICTIONS
     * =========================================================================
     */
    evaluateGeographicRisk(
        transaction,
        customer
    ) {
        const highRiskCountries = [
            "IRAN",
            "NORTH KOREA",
            "SYRIA",
            "AFGHANISTAN"
        ];

        const country =
            transaction.country?.toUpperCase();

        if (
            highRiskCountries.includes(
                country
            )
        ) {
            return 90;
        }

        return 10;
    }

    /**
     * =========================================================================
     * CUSTOMER PROFILE RISK
     * =========================================================================
     */
    evaluateCustomerRisk(customer) {
        if (!customer) {
            return 50;
        }

        let risk = 0;

        if (!customer.kycVerified) {
            risk += 40;
        }

        if (!customer.addressVerified) {
            risk += 15;
        }

        if (
            customer.customerType ===
            "HIGH_RISK_BUSINESS"
        ) {
            risk += 30;
        }

        if (
            customer.accountAgeMonths < 3
        ) {
            risk += 20;
        }

        return Math.min(
            risk,
            100
        );
    }

    /**
     * =========================================================================
     * STRUCTURING / SMURFING DETECTION
     * =========================================================================
     */
    detectStructuring(transaction) {
        let risk = 0;

        if (
            transaction.multipleSmallTransactions
        ) {
            risk += 70;
        }

        if (
            transaction.thresholdAvoidance
        ) {
            risk += 80;
        }

        return Math.min(
            risk,
            100
        );
    }

    /**
     * =========================================================================
     * TRANSACTION MONITORING
     * =========================================================================
     */
    monitorTransaction(transaction) {
        const amount =
            transaction.amount || 0;

        if (
            amount > 50000000
        ) {
            return 90;
        }

        if (
            amount > 10000000
        ) {
            return 50;
        }

        return 10;
    }

    /**
     * =========================================================================
     * SUSPICIOUS BEHAVIOUR
     * =========================================================================
     */
    analyzeSuspiciousBehaviour(
        transaction,
        customer
    ) {
        let risk = 0;

        if (
            transaction.rapidMovementOfFunds
        ) {
            risk += 40;
        }

        if (
            transaction.cashIntensivePattern
        ) {
            risk += 35;
        }

        if (
            transaction.highVelocityTransfers
        ) {
            risk += 40;
        }

        if (
            transaction.roundDollarAmounts
        ) {
            risk += 15;
        }

        return Math.min(
            risk,
            100
        );
    }

    /**
     * =========================================================================
     * AML SCORE CALCULATION
     * =========================================================================
     */
    calculateAMLScore(risks) {
        const score =
            (risks.sanctionsRisk *
                this.config.weights.sanctions +
                risks.pepRisk *
                    this.config.weights.pep +
                risks.adverseMediaRisk *
                    this.config.weights
                        .adverseMedia +
                risks.geographyRisk *
                    this.config.weights
                        .geography +
                risks.customerRisk *
                    this.config.weights
                        .customerProfile +
                risks.structuringRisk *
                    this.config.weights
                        .structuring +
                risks.monitoringRisk *
                    this.config.weights
                        .transactionMonitoring +
                risks.suspiciousBehaviourRisk *
                    this.config.weights
                        .suspiciousBehaviour) /
            100;

        return Number(
            score.toFixed(2)
        );
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

        if (score >= 80) {
            return "HIGH";
        }

        if (score >= 60) {
            return "MEDIUM";
        }

        return "LOW";
    }

    /**
     * =========================================================================
     * DECISION ENGINE
     * =========================================================================
     */
    generateDecision(
        score,
        riskLevel
    ) {
        switch (riskLevel) {
            case "CRITICAL":
                return {
                    action: "BLOCK",
                    reportRequired: true,
                    escalate: true
                };

            case "HIGH":
                return {
                    action: "HOLD",
                    reportRequired: true,
                    escalate: true
                };

            case "MEDIUM":
                return {
                    action: "MANUAL_REVIEW",
                    reportRequired: false,
                    escalate: false
                };

            default:
                return {
                    action: "ALLOW",
                    reportRequired: false,
                    escalate: false
                };
        }
    }

    /**
     * =========================================================================
     * RECOMMENDATIONS
     * =========================================================================
     */
    generateRecommendations(
        level,
        indicators
    ) {
        const recommendations = [];

        if (
            indicators.sanctionsRisk > 0
        ) {
            recommendations.push(
                "Immediate sanctions review required."
            );
        }

        if (
            indicators.pepRisk > 0
        ) {
            recommendations.push(
                "Apply Enhanced Due Diligence (EDD)."
            );
        }

        if (
            indicators.structuringRisk > 50
        ) {
            recommendations.push(
                "Review for potential structuring activity."
            );
        }

        if (
            indicators.adverseMediaRisk > 0
        ) {
            recommendations.push(
                "Risk officer should assess adverse media findings."
            );
        }

        if (
            level === "CRITICAL"
        ) {
            recommendations.push(
                "Freeze transaction immediately."
            );

            recommendations.push(
                "Generate Suspicious Transaction Report (STR)."
            );

            recommendations.push(
                "Escalate to Compliance Officer."
            );
        }

        return recommendations;
    }

    /**
     * =========================================================================
     * STR / SAR CREATION
     * =========================================================================
     */
    createSTR(transaction, result) {
        return {
            reportId:
                crypto.randomUUID(),

            type:
                "SUSPICIOUS_TRANSACTION_REPORT",

            transactionId:
                transaction.id,

            severity:
                result.riskLevel,

            amlScore:
                result.amlScore,

            reportedAt:
                new Date().toISOString(),

            status:
                "PENDING_SUBMISSION"
        };
    }

    /**
     * =========================================================================
     * COMPLIANCE CASE MANAGEMENT
     * =========================================================================
     */
    createComplianceCase(
        transaction,
        result
    ) {
        return {
            caseId:
                crypto.randomUUID(),

            transactionId:
                transaction.id,

            customerId:
                transaction.customerId,

            riskLevel:
                result.riskLevel,

            amlScore:
                result.amlScore,

            status:
                "OPEN",

            createdAt:
                new Date().toISOString(),

            assignedTo:
                null
        };
    }

    /**
     * =========================================================================
     * PERIODIC CUSTOMER RISK REVIEW
     * =========================================================================
     */
    async reviewCustomerRisk(
        customer
    ) {
        const customerRisk =
            this.evaluateCustomerRisk(
                customer
            );

        const pepRisk =
            this.screenPEP(
                customer
            );

        const sanctionsRisk =
            this.screenSanctions(
                customer
            );

        const overall =
            (
                customerRisk +
                pepRisk +
                sanctionsRisk
            ) / 3;

        return {
            reviewDate:
                new Date().toISOString(),

            customerId:
                customer.id,

            reviewScore:
                Number(
                    overall.toFixed(2)
                ),

            classification:
                this.classifyRisk(
                    overall
                )
        };
    }
}

module.exports =
    new AMLScreeningService();