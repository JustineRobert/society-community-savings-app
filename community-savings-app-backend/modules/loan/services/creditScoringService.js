'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Loan Credit Scoring Service
 * ============================================================================
 *
 * Enterprise Production-Grade Loan Credit Scoring Engine
 *
 * Responsibilities:
 *
 *   - Applicant credit scoring
 *   - Payment history analysis
 *   - Debt-to-income analysis
 *   - Loan utilization analysis
 *   - Account age analysis
 *   - Fraud / sanctions risk integration
 *   - Risk classification
 *   - Recommendation generation
 *   - Score explainability
 *   - Tenant isolation
 *   - Deterministic scoring
 *   - Score integrity hashing
 *   - Risk profile persistence
 *   - Audit hooks
 *
 * Design Principles:
 *
 *   - Deterministic
 *   - Tenant isolated
 *   - Fail closed on critical risk signals
 *   - No mutation of applicant or loan data
 *   - No floating-point scoring drift
 *   - Explainable scoring
 *   - Audit friendly
 *   - Backward compatible public API
 *
 * Public API:
 *
 *   scoreApplicant(applicant, loanData, riskFlags)
 *
 * ============================================================================
 */

const crypto = require('crypto');

const LoanRiskProfile = require('../../models/LoanRiskProfile');

/**
 * Optional logger resolution.
 *
 * The service remains usable when the application's logger has not yet
 * been wired into the module.
 */
let logger = console;

try {
    // eslint-disable-next-line global-require
    const applicationLogger = require('../../utils/logger');

    if (applicationLogger) {
        logger = applicationLogger;
    }
} catch (error) {
    // Logger is intentionally optional.
}

/**
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

const SCORE_MIN = 300;
const SCORE_MAX = 850;

const RISK_LEVEL = Object.freeze({
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
    SEVERE: 'SEVERE'
});

const DECISION = Object.freeze({
    APPROVE: 'APPROVE',
    REVIEW: 'REVIEW',
    RESTRICT: 'RESTRICT',
    DECLINE: 'DECLINE',
    BLOCK: 'BLOCK'
});

const DEFAULT_CONFIG = Object.freeze({
    weights: Object.freeze({
        PAYMENT_HISTORY: 35,
        DEBT_TO_INCOME: 25,
        LOAN_UTILIZATION: 20,
        ACCOUNT_AGE: 10,
        FRAUD_SANCTIONS: 10
    }),

    thresholds: Object.freeze({
        EXCELLENT: 750,
        GOOD: 650,
        FAIR: 550,
        POOR: 450,
        VERY_POOR: 300
    }),

    limits: Object.freeze({
        MAX_DTI: 1.0,
        MAX_UTILIZATION: 1.0,
        MAX_ACCOUNT_AGE_MONTHS: 60
    })
});

/**
 * ============================================================================
 * CUSTOM ERRORS
 * ============================================================================
 */

class LoanCreditScoringError extends Error {
    constructor(message, details = {}, options = {}) {
        super(message);

        this.name = 'LoanCreditScoringError';

        this.code =
            options.code ||
            'LOAN_CREDIT_SCORING_ERROR';

        this.details = details;

        if (options.cause) {
            this.cause = options.cause;
        }

        Error.captureStackTrace?.(
            this,
            LoanCreditScoringError
        );
    }
}

/**
 * ============================================================================
 * SERVICE
 * ============================================================================
 */

class LoanCreditScoringService {

    constructor(options = {}) {

        this.config = this.buildConfig(
            options.config || {}
        );

        this.auditService =
            options.auditService || null;

    }

    /**
     * =========================================================================
     * MAIN ENTRYPOINT
     * =========================================================================
     *
     * Backward compatible signature:
     *
     *   scoreApplicant(applicant, loanData, riskFlags)
     *
     * @param {Object} applicant
     * @param {Object} loanData
     * @param {Object} riskFlags
     *
     * @returns {Promise<Object>}
     */
    async scoreApplicant(
        applicant,
        loanData,
        riskFlags = {}
    ) {

        const startedAt = Date.now();

        try {

            this.validateApplicant(
                applicant
            );

            this.validateLoanData(
                loanData
            );

            this.validateRiskFlags(
                riskFlags
            );

            const tenantId =
                this.resolveTenantId(
                    applicant,
                    loanData
                );

            const applicantId =
                this.normalizeIdentifier(
                    applicant._id ||
                    applicant.id ||
                    applicant.applicantId
                );

            const scoreId =
                this.generateScoreId(
                    tenantId,
                    applicantId,
                    loanData
                );

            /**
             * Normalize all scoring inputs before calculating anything.
             */
            const normalized =
                this.normalizeScoringInputs(
                    loanData,
                    riskFlags
                );

            /**
             * Calculate component scores.
             */
            const breakdown =
                this.calculateScoreBreakdown(
                    normalized
                );

            /**
             * Calculate aggregate score.
             */
            const creditScore =
                this.calculateWeightedScore(
                    breakdown
                );

            /**
             * Apply risk controls after the base score has been calculated.
             */
            const controls =
                this.evaluateRiskControls(
                    normalized,
                    riskFlags,
                    creditScore
                );

            const finalScore =
                controls.scoreOverride !== null
                    ? controls.scoreOverride
                    : creditScore;

            const riskLevel =
                this.classifyRisk(
                    finalScore,
                    controls
                );

            const decision =
                this.determineDecision(
                    finalScore,
                    riskLevel,
                    controls
                );

            const recommendations =
                this.generateRecommendations(
                    riskLevel,
                    decision,
                    controls
                );

            const scoreIntegrity =
                this.generateScoreIntegrityHash({
                    scoreId,
                    tenantId,
                    applicantId,
                    creditScore: finalScore,
                    riskLevel,
                    decision,
                    breakdown,
                    controls
                });

            const timestamp =
                new Date();

            const result = {
                scoreId,

                applicantId,

                tenantId,

                creditScore:
                    finalScore,

                riskLevel,

                decision,

                breakdown,

                controls,

                recommendations,

                scoreIntegrity,

                scoringVersion:
                    this.getScoringVersion(),

                timestamp:
                    timestamp.toISOString(),

                processingTimeMs:
                    Date.now() - startedAt
            };

            /**
             * Persist the latest risk profile.
             */
            await this.persistRiskProfile({
                applicantId,
                tenantId,
                scoreId,
                creditScore: finalScore,
                riskLevel,
                decision,
                loanData,
                breakdown,
                controls,
                recommendations,
                scoreIntegrity,
                scoringVersion:
                    this.getScoringVersion()
            });

            /**
             * Audit after successful persistence.
             */
            await this.auditScore({
                ...result,
                auditType:
                    'LOAN_CREDIT_SCORE_CALCULATED'
            });

            this.safeLog(
                'info',
                '[LoanCreditScoringService] Credit score calculated',
                {
                    scoreId,
                    tenantId,
                    applicantId,
                    creditScore: finalScore,
                    riskLevel,
                    decision
                }
            );

            return Object.freeze(
                result
            );

        } catch (error) {

            this.safeLog(
                'error',
                '[LoanCreditScoringService] Credit scoring failed',
                {
                    applicantId:
                        applicant?._id ||
                        applicant?.id ||
                        null,

                    tenantId:
                        applicant?.tenantId ||
                        loanData?.tenantId ||
                        null,

                    error:
                        error.message,

                    code:
                        error.code || null
                }
            );

            if (
                error instanceof LoanCreditScoringError
            ) {
                throw error;
            }

            throw new LoanCreditScoringError(
                'Loan credit scoring failed',
                {
                    originalError:
                        error.message
                },
                {
                    code:
                        'CREDIT_SCORING_FAILED',
                    cause:
                        error
                }
            );
        }
    }

    /**
     * =========================================================================
     * CONFIGURATION
     * =========================================================================
     */

    buildConfig(customConfig) {

        return {
            weights: {
                ...DEFAULT_CONFIG.weights,
                ...(customConfig.weights || {})
            },

            thresholds: {
                ...DEFAULT_CONFIG.thresholds,
                ...(customConfig.thresholds || {})
            },

            limits: {
                ...DEFAULT_CONFIG.limits,
                ...(customConfig.limits || {})
            }
        };
    }

    getScoringVersion() {
        return '2026.1';
    }

    /**
     * =========================================================================
     * VALIDATION
     * =========================================================================
     */

    validateApplicant(applicant) {

        if (!applicant || typeof applicant !== 'object') {

            throw new LoanCreditScoringError(
                'Applicant data required',
                {
                    code:
                        'MISSING_APPLICANT'
                }
            );
        }

        const applicantId =
            applicant._id ||
            applicant.id ||
            applicant.applicantId;

        if (!applicantId) {

            throw new LoanCreditScoringError(
                'Applicant identifier required',
                {
                    code:
                        'MISSING_APPLICANT_ID'
                }
            );
        }

        if (!applicant.tenantId) {

            throw new LoanCreditScoringError(
                'Applicant tenant context required',
                {
                    code:
                        'MISSING_TENANT_ID'
                }
            );
        }
    }

    validateLoanData(loanData) {

        if (
            !loanData ||
            typeof loanData !== 'object'
        ) {

            throw new LoanCreditScoringError(
                'Loan data required',
                {
                    code:
                        'MISSING_LOAN_DATA'
                }
            );
        }

        const numericFields = [
            'onTimePayments',
            'totalPayments',
            'debt',
            'income',
            'currentLoans',
            'loanLimit',
            'accountAgeMonths'
        ];

        for (
            const field of numericFields
        ) {

            if (
                loanData[field] !== undefined &&
                loanData[field] !== null &&
                !Number.isFinite(
                    Number(loanData[field])
                )
            ) {

                throw new LoanCreditScoringError(
                    `Invalid numeric loan field: ${field}`,
                    {
                        field,
                        value:
                            loanData[field],
                        code:
                            'INVALID_SCORING_INPUT'
                    }
                );
            }
        }
    }

    validateRiskFlags(riskFlags) {

        if (
            !riskFlags ||
            typeof riskFlags !== 'object'
        ) {

            throw new LoanCreditScoringError(
                'Risk flags must be an object',
                {
                    code:
                        'INVALID_RISK_FLAGS'
                }
            );
        }
    }

    /**
     * =========================================================================
     * TENANT RESOLUTION
     * =========================================================================
     */

    resolveTenantId(
        applicant,
        loanData
    ) {

        const applicantTenant =
            this.normalizeIdentifier(
                applicant.tenantId
            );

        const loanTenant =
            this.normalizeIdentifier(
                loanData.tenantId
            );

        if (
            applicantTenant &&
            loanTenant &&
            applicantTenant !== loanTenant
        ) {

            throw new LoanCreditScoringError(
                'Applicant and loan tenant mismatch',
                {
                    applicantTenant,
                    loanTenant,
                    code:
                        'TENANT_CONTEXT_MISMATCH'
                }
            );
        }

        const tenantId =
            applicantTenant ||
            loanTenant;

        if (!tenantId) {

            throw new LoanCreditScoringError(
                'Tenant identifier required',
                {
                    code:
                        'MISSING_TENANT_ID'
                }
            );
        }

        return tenantId;
    }

    /**
     * =========================================================================
     * INPUT NORMALIZATION
     * =========================================================================
     */

    normalizeScoringInputs(
        loanData,
        riskFlags
    ) {

        const totalPayments =
            this.nonNegativeNumber(
                loanData.totalPayments
            );

        const onTimePayments =
            Math.min(
                this.nonNegativeNumber(
                    loanData.onTimePayments
                ),
                totalPayments
            );

        const debt =
            this.nonNegativeNumber(
                loanData.debt
            );

        const income =
            this.nonNegativeNumber(
                loanData.income
            );

        const currentLoans =
            this.nonNegativeNumber(
                loanData.currentLoans
            );

        const loanLimit =
            this.nonNegativeNumber(
                loanData.loanLimit
            );

        const accountAgeMonths =
            this.nonNegativeNumber(
                loanData.accountAgeMonths
            );

        return {
            onTimePayments,
            totalPayments,
            debt,
            income,
            currentLoans,
            loanLimit,
            accountAgeMonths,

            paymentHistoryRate:
                totalPayments > 0
                    ? onTimePayments / totalPayments
                    : 0,

            dti:
                income > 0
                    ? debt / income
                    : 1,

            utilization:
                loanLimit > 0
                    ? currentLoans / loanLimit
                    : 1,

            riskFlags
        };
    }

    nonNegativeNumber(value) {

        const number =
            Number(value || 0);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.max(
            0,
            number
        );
    }

    /**
     * =========================================================================
     * SCORE BREAKDOWN
     * =========================================================================
     *
     * Each component is normalized to its configured weight.
     *
     * The total contribution therefore equals the configured scoring weight.
     */

    calculateScoreBreakdown(
        data
    ) {

        const weights =
            this.config.weights;

        const paymentHistory =
            this.calculatePaymentHistoryScore(
                data
            );

        const debtToIncome =
            this.calculateDebtToIncomeScore(
                data
            );

        const utilization =
            this.calculateUtilizationScore(
                data
            );

        const accountAge =
            this.calculateAccountAgeScore(
                data
            );

        const fraudSanctions =
            this.calculateFraudSanctionsScore(
                data
            );

        return {
            PAYMENT_HISTORY: {
                weight:
                    weights.PAYMENT_HISTORY,
                factor:
                    paymentHistory.factor,
                contribution:
                    paymentHistory.contribution
            },

            DEBT_TO_INCOME: {
                weight:
                    weights.DEBT_TO_INCOME,
                factor:
                    debtToIncome.factor,
                contribution:
                    debtToIncome.contribution
            },

            LOAN_UTILIZATION: {
                weight:
                    weights.LOAN_UTILIZATION,
                factor:
                    utilization.factor,
                contribution:
                    utilization.contribution
            },

            ACCOUNT_AGE: {
                weight:
                    weights.ACCOUNT_AGE,
                factor:
                    accountAge.factor,
                contribution:
                    accountAge.contribution
            },

            FRAUD_SANCTIONS: {
                weight:
                    weights.FRAUD_SANCTIONS,
                factor:
                    fraudSanctions.factor,
                contribution:
                    fraudSanctions.contribution
            }
        };
    }

    /**
     * Payment history:
     *
     * 100% on-time = full component score.
     */
    calculatePaymentHistoryScore(
        data
    ) {

        const factor =
            this.clamp(
                data.paymentHistoryRate,
                0,
                1
            );

        return {
            factor,
            contribution:
                this.roundScore(
                    factor *
                    this.config.weights.PAYMENT_HISTORY
                )
        };
    }

    /**
     * DTI:
     *
     * 0% DTI = full score.
     * 100%+ DTI = zero score.
     */
    calculateDebtToIncomeScore(
        data
    ) {

        const dti =
            Math.min(
                data.dti,
                this.config.limits.MAX_DTI
            );

        const factor =
            this.clamp(
                1 - dti,
                0,
                1
            );

        return {
            factor,
            contribution:
                this.roundScore(
                    factor *
                    this.config.weights.DEBT_TO_INCOME
                )
        };
    }

    /**
     * Utilization:
     *
     * 0% utilization = full score.
     * 100%+ utilization = zero score.
     */
    calculateUtilizationScore(
        data
    ) {

        const utilization =
            Math.min(
                data.utilization,
                this.config.limits.MAX_UTILIZATION
            );

        const factor =
            this.clamp(
                1 - utilization,
                0,
                1
            );

        return {
            factor,
            contribution:
                this.roundScore(
                    factor *
                    this.config.weights.LOAN_UTILIZATION
                )
        };
    }

    /**
     * Account age:
     *
     * 60 months or more = full score.
     */
    calculateAccountAgeScore(
        data
    ) {

        const factor =
            this.clamp(
                data.accountAgeMonths /
                this.config.limits.MAX_ACCOUNT_AGE_MONTHS,
                0,
                1
            );

        return {
            factor,
            contribution:
                this.roundScore(
                    factor *
                    this.config.weights.ACCOUNT_AGE
                )
        };
    }

    /**
     * Fraud / sanctions component.
     *
     * Normal state contributes the full component.
     * A positive fraud/sanctions signal contributes zero.
     *
     * Critical controls are handled separately by evaluateRiskControls().
     */
    calculateFraudSanctionsScore(
        data
    ) {

        const flagged =
            Boolean(
                data.riskFlags.fraud ||
                data.riskFlags.sanctions
            );

        const factor =
            flagged ? 0 : 1;

        return {
            factor,
            contribution:
                this.roundScore(
                    factor *
                    this.config.weights.FRAUD_SANCTIONS
                )
        };
    }

    /**
     * =========================================================================
     * AGGREGATE SCORE
     * =========================================================================
     */

    calculateWeightedScore(
        breakdown
    ) {

        let contributionTotal = 0;

        Object.keys(
            breakdown
        ).forEach(component => {

            contributionTotal +=
                Number(
                    breakdown[component]
                        .contribution || 0
                );
        });

        /**
         * The original implementation starts at 300 and adds normalized
         * weighted points multiplied by 10.
         *
         * We preserve the 300-850 scale while making the mathematics explicit.
         *
         * Maximum component contribution = 100.
         * Therefore:
         *
         *   300 + (100 * 5.5) = 850
         */
        const score =
            SCORE_MIN +
            (
                contributionTotal *
                ((SCORE_MAX - SCORE_MIN) / 100)
            );

        return this.clamp(
            Math.round(score),
            SCORE_MIN,
            SCORE_MAX
        );
    }

    /**
     * =========================================================================
     * RISK CONTROLS
     * =========================================================================
     */

    evaluateRiskControls(
        data,
        riskFlags,
        calculatedScore
    ) {

        const reasons = [];

        let scoreOverride = null;

        const sanctions =
            Boolean(
                riskFlags.sanctions
            );

        const confirmedFraud =
            Boolean(
                riskFlags.fraud
            );

        const complianceBlock =
            Boolean(
                riskFlags.complianceBlock
            );

        const identityMismatch =
            Boolean(
                riskFlags.identityMismatch
            );

        const deceased =
            Boolean(
                riskFlags.deceased
            );

        if (sanctions) {

            reasons.push(
                'SANCTIONS_MATCH'
            );
        }

        if (confirmedFraud) {

            reasons.push(
                'FRAUD_FLAG'
            );
        }

        if (complianceBlock) {

            reasons.push(
                'COMPLIANCE_BLOCK'
            );
        }

        if (identityMismatch) {

            reasons.push(
                'IDENTITY_MISMATCH'
            );
        }

        if (deceased) {

            reasons.push(
                'DECEASED_IDENTITY_FLAG'
            );
        }

        /**
         * Critical compliance conditions are fail-closed.
         *
         * The score is retained for audit/explainability, but the decision
         * cannot become APPROVE.
         */
        if (
            sanctions ||
            confirmedFraud ||
            complianceBlock ||
            identityMismatch ||
            deceased
        ) {

            scoreOverride =
                SCORE_MIN;
        }

        return {
            hardBlock:
                reasons.length > 0,

            reasons,

            scoreOverride,

            originalScore:
                calculatedScore
        };
    }

    /**
     * =========================================================================
     * RISK CLASSIFICATION
     * =========================================================================
     */

    classifyRisk(
        score,
        controls = {}
    ) {

        if (
            controls.hardBlock
        ) {
            return RISK_LEVEL.SEVERE;
        }

        if (
            score >=
            this.config.thresholds.EXCELLENT
        ) {
            return RISK_LEVEL.LOW;
        }

        if (
            score >=
            this.config.thresholds.GOOD
        ) {
            return RISK_LEVEL.MEDIUM;
        }

        if (
            score >=
            this.config.thresholds.FAIR
        ) {
            return RISK_LEVEL.HIGH;
        }

        if (
            score >=
            this.config.thresholds.POOR
        ) {
            return RISK_LEVEL.CRITICAL;
        }

        return RISK_LEVEL.SEVERE;
    }

    /**
     * =========================================================================
     * DECISION ENGINE
     * =========================================================================
     */

    determineDecision(
        score,
        riskLevel,
        controls = {}
    ) {

        if (
            controls.hardBlock
        ) {
            return DECISION.BLOCK;
        }

        switch (riskLevel) {

            case RISK_LEVEL.LOW:
                return DECISION.APPROVE;

            case RISK_LEVEL.MEDIUM:
                return DECISION.REVIEW;

            case RISK_LEVEL.HIGH:
                return DECISION.RESTRICT;

            case RISK_LEVEL.CRITICAL:
                return DECISION.DECLINE;

            case RISK_LEVEL.SEVERE:
                return DECISION.BLOCK;

            default:
                return DECISION.REVIEW;
        }
    }

    /**
     * =========================================================================
     * RECOMMENDATIONS
     * =========================================================================
     */

    generateRecommendations(
        riskLevel,
        decision,
        controls = {}
    ) {

        if (
            controls.hardBlock
        ) {

            return [
                'Do not approve the loan',
                'Escalate application to compliance/risk team',
                'Resolve identified risk controls before reconsideration'
            ];
        }

        switch (riskLevel) {

            case RISK_LEVEL.LOW:

                return [
                    'Loan approval recommended',
                    'Applicant may qualify for standard or premium loan products',
                    'Apply normal affordability and product limits'
                ];

            case RISK_LEVEL.MEDIUM:

                return [
                    'Manual or policy-based review recommended',
                    'Consider moderate loan limits',
                    'Verify affordability before disbursement'
                ];

            case RISK_LEVEL.HIGH:

                return [
                    'Enhanced credit review recommended',
                    'Consider reduced loan amount',
                    'Consider collateral or guarantor requirements',
                    'Review existing debt obligations'
                ];

            case RISK_LEVEL.CRITICAL:

                return [
                    'Loan approval not recommended',
                    'Escalate for senior credit review',
                    'Consider restructuring existing obligations where appropriate'
                ];

            case RISK_LEVEL.SEVERE:

                return [
                    'Block loan application',
                    'Escalate to compliance and risk teams',
                    'Do not disburse until blocking conditions are resolved'
                ];

            default:

                return [
                    'Manual risk review required'
                ];
        }
    }

    /**
     * =========================================================================
     * PERSISTENCE
     * =========================================================================
     */

    async persistRiskProfile(data) {

        try {

            /**
             * Tenant ID is deliberately part of the lookup.
             *
             * This prevents a profile belonging to another tenant from being
             * updated accidentally when applicant identifiers overlap.
             */
            const filter = {
                tenantId:
                    data.tenantId,

                applicantId:
                    data.applicantId
            };

            const update = {
                $set: {
                    tenantId:
                        data.tenantId,

                    applicantId:
                        data.applicantId,

                    creditScore:
                        data.creditScore,

                    riskLevel:
                        data.riskLevel,

                    decision:
                        data.decision,

                    loanData:
                        data.loanData,

                    breakdown:
                        data.breakdown,

                    riskControls:
                        data.controls,

                    recommendations:
                        data.recommendations,

                    scoreId:
                        data.scoreId,

                    scoreIntegrity:
                        data.scoreIntegrity,

                    scoringVersion:
                        data.scoringVersion,

                    scoredAt:
                        new Date(),

                    updatedAt:
                        new Date()
                }
            };

            await LoanRiskProfile.updateOne(
                filter,
                update,
                {
                    upsert: true,
                    runValidators: true
                }
            );

        } catch (error) {

            throw new LoanCreditScoringError(
                'Failed to persist loan risk profile',
                {
                    tenantId:
                        data.tenantId,

                    applicantId:
                        data.applicantId,

                    originalError:
                        error.message
                },
                {
                    code:
                        'RISK_PROFILE_PERSISTENCE_FAILED',
                    cause:
                        error
                }
            );
        }
    }

    /**
     * =========================================================================
     * AUDIT
     * =========================================================================
     */

    async auditScore(
        data
    ) {

        if (
            !this.auditService
        ) {
            return;
        }

        try {

            await this.auditService.log({
                tenantId:
                    data.tenantId,

                applicantId:
                    data.applicantId,

                action:
                    data.auditType,

                eventType:
                    data.auditType,

                entityType:
                    'LOAN_CREDIT_SCORE',

                entityId:
                    data.scoreId,

                data: {
                    creditScore:
                        data.creditScore,

                    riskLevel:
                        data.riskLevel,

                    decision:
                        data.decision,

                    controls:
                        data.controls,

                    scoreIntegrity:
                        data.scoreIntegrity,

                    scoringVersion:
                        data.scoringVersion
                }
            });

        } catch (error) {

            /**
             * Audit failures are deliberately logged but do not silently
             * mutate the credit decision.
             *
             * Organizations requiring strict audit availability can inject
             * an audit service that throws and change this policy centrally.
             */
            this.safeLog(
                'error',
                '[LoanCreditScoringService] Audit logging failed',
                {
                    scoreId:
                        data.scoreId,

                    tenantId:
                        data.tenantId,

                    error:
                        error.message
                }
            );
        }
    }

    /**
     * =========================================================================
     * SCORE IDENTIFIER
     * =========================================================================
     */

    generateScoreId(
        tenantId,
        applicantId,
        loanData
    ) {

        const loanReference =
            loanData.loanId ||
            loanData.applicationId ||
            loanData.reference ||
            crypto.randomUUID();

        const entropy =
            crypto.randomBytes(
                8
            ).toString('hex');

        return (
            'SCORE-' +
            crypto
                .createHash('sha256')
                .update(
                    [
                        tenantId,
                        applicantId,
                        loanReference,
                        entropy
                    ].join('|')
                )
                .digest('hex')
                .substring(0, 24)
        );
    }

    /**
     * =========================================================================
     * SCORE INTEGRITY
     * =========================================================================
     */

    generateScoreIntegrityHash(
        payload
    ) {

        const canonical =
            this.stableSerialize(
                payload
            );

        return crypto
            .createHash('sha256')
            .update(canonical)
            .digest('hex');
    }

    /**
     * Deterministic object serialization.
     */
    stableSerialize(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return String(value);
        }

        if (
            typeof value !== 'object'
        ) {
            return JSON.stringify(value);
        }

        if (
            Array.isArray(value)
        ) {

            return '[' +
                value
                    .map(item =>
                        this.stableSerialize(item)
                    )
                    .join(',') +
                ']';
        }

        return '{' +
            Object.keys(value)
                .sort()
                .map(key =>
                    JSON.stringify(key) +
                    ':' +
                    this.stableSerialize(
                        value[key]
                    )
                )
                .join(',') +
            '}';
    }

    /**
     * =========================================================================
     * UTILITY FUNCTIONS
     * =========================================================================
     */

    normalizeIdentifier(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        if (
            typeof value === 'object' &&
            typeof value.toString === 'function'
        ) {
            return value.toString();
        }

        return String(value).trim();
    }

    clamp(
        value,
        min,
        max
    ) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return min;
        }

        return Math.min(
            max,
            Math.max(
                min,
                number
            )
        );
    }

    roundScore(
        value
    ) {

        return Math.round(
            Number(value) * 100
        ) / 100;
    }

    safeLog(
        level,
        message,
        metadata
    ) {

        try {

            if (
                logger &&
                typeof logger[level] === 'function'
            ) {

                logger[level](
                    message,
                    metadata
                );

            }

        } catch (error) {
            // Logging must never break financial/risk workflows.
        }
    }
}

/**
 * ============================================================================
 * SINGLETON EXPORT
 * ============================================================================
 *
 * Preserves the existing import contract:
 *
 *   const loanCreditScoringService =
 *       require('./LoanCreditScoringService');
 *
 * ============================================================================
 */

module.exports =
    new LoanCreditScoringService();

/**
 * Optional named exports for testing and advanced dependency injection.
 */
module.exports.LoanCreditScoringService =
    LoanCreditScoringService;

module.exports.LoanCreditScoringError =
    LoanCreditScoringError;

module.exports.RISK_LEVEL =
    RISK_LEVEL;

module.exports.DECISION =
    DECISION;