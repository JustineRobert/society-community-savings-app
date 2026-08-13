// backend/modules/risk/risk.service.js
'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Risk Scoring Service
 * ============================================================================
 *
 * Responsibilities
 * ----------------
 * • Deterministic transaction risk scoring
 * • Tenant-aware rule configuration
 * • Rule-based risk evaluation
 * • Risk decision classification
 * • Input validation and normalization
 * • Correlation ID propagation
 * • Scoring versioning
 * • Input fingerprinting
 * • Explainable scoring
 * • Operational metrics hooks
 * • Structured logging
 * • Failure-safe diagnostics
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Transaction execution
 * • Ledger posting
 * • Payment processing
 * • AML case management
 * • Sanctions screening
 * • Account blocking
 *
 * ============================================================================
 */

const crypto = require('crypto');

const PROVIDER = 'TITech Community Capital';

const SCORING_VERSION =
    'risk-v1';

const MAX_SCORE = 100;

const DECISIONS = Object.freeze({
    APPROVE: 'APPROVE',
    REVIEW: 'REVIEW',
    BLOCK: 'BLOCK',
});

const RISK_RULES = Object.freeze({
    LARGE_TX_AMOUNT: 1_000_000,
    NEW_ACCOUNT_MINUTES: 60,
    HIGH_TX_COUNT: 5,
});

const RULE_WEIGHTS = Object.freeze({
    LARGE_TRANSACTION: 30,
    NEW_ACCOUNT: 25,
    HIGH_VELOCITY: 20,
    LOCATION_MISMATCH: 25,
});

const DEFAULT_OPTIONS = Object.freeze({
    rules: RISK_RULES,
    weights: RULE_WEIGHTS,
    scoringVersion: SCORING_VERSION,
});


/**
 * ============================================================================
 * Safe Logger
 * ============================================================================
 */

let logger = console;

try {
    // eslint-disable-next-line global-require
    const importedLogger = require('../utils/logger');

    if (importedLogger) {
        logger = importedLogger;
    }
} catch (error) {
    // Deliberately fall back to console.
    // Risk scoring must never fail because optional logging is unavailable.
    logger = console;
}


/**
 * ============================================================================
 * Runtime Statistics
 * ============================================================================
 */

const statistics = {
    evaluations: 0,
    approved: 0,
    reviewed: 0,
    blocked: 0,
    failures: 0,
};


/**
 * ============================================================================
 * Utility Functions
 * ============================================================================
 */

function generateCorrelationId() {
    return crypto.randomUUID();
}


function normalizeNumber(value, fallback = 0) {
    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? value
            : fallback;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : fallback;
    }

    return fallback;
}


function normalizeBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return [
            'true',
            '1',
            'yes',
            'y',
        ].includes(value.toLowerCase());
    }

    if (typeof value === 'number') {
        return value === 1;
    }

    return false;
}


function normalizeString(value, fallback = null) {
    if (
        typeof value !== 'string' ||
        value.trim() === ''
    ) {
        return fallback;
    }

    return value.trim();
}


/**
 * ============================================================================
 * Input Validation
 * ============================================================================
 */

function validateTransactionInput(data = {}) {
    if (!data || typeof data !== 'object') {
        throw new TypeError(
            'Risk evaluation input must be an object'
        );
    }

    if (
        data.tenantId !== undefined &&
        data.tenantId !== null &&
        typeof data.tenantId !== 'string'
    ) {
        throw new TypeError(
            'tenantId must be a string'
        );
    }

    const amount =
        normalizeNumber(data.amount, NaN);

    if (!Number.isFinite(amount)) {
        throw new TypeError(
            'amount must be a finite number'
        );
    }

    if (amount < 0) {
        throw new RangeError(
            'amount cannot be negative'
        );
    }

    const userAgeMinutes =
        normalizeNumber(
            data.userAgeMinutes,
            0
        );

    if (userAgeMinutes < 0) {
        throw new RangeError(
            'userAgeMinutes cannot be negative'
        );
    }

    const transactionCount =
        normalizeNumber(
            data.transactionCount,
            0
        );

    if (transactionCount < 0) {
        throw new RangeError(
            'transactionCount cannot be negative'
        );
    }

    return true;
}


/**
 * ============================================================================
 * Canonical Input
 * ============================================================================
 *
 * Canonicalization guarantees that the same logical input produces the same
 * fingerprint regardless of object property ordering.
 *
 * IMPORTANT:
 * Do not include secrets, credentials, tokens, or raw authentication material.
 */

function buildCanonicalInput(data = {}) {
    return {
        tenantId:
            normalizeString(data.tenantId),

        amount:
            normalizeNumber(data.amount),

        userAgeMinutes:
            normalizeNumber(
                data.userAgeMinutes
            ),

        transactionCount:
            normalizeNumber(
                data.transactionCount
            ),

        locationMismatch:
            normalizeBoolean(
                data.locationMismatch
            ),

        currency:
            normalizeString(
                data.currency
            ),

        transactionType:
            normalizeString(
                data.transactionType
            ),

        accountType:
            normalizeString(
                data.accountType
            ),
    };
}


/**
 * ============================================================================
 * Input Fingerprint
 * ============================================================================
 */

function createInputFingerprint(data) {
    const canonical =
        buildCanonicalInput(data);

    return crypto
        .createHash('sha256')
        .update(
            JSON.stringify(canonical),
            'utf8'
        )
        .digest('hex');
}


/**
 * ============================================================================
 * Rule Configuration
 * ============================================================================
 */

function resolveConfiguration(options = {}) {
    const rules = {
        ...RISK_RULES,
        ...(options.rules || {}),
    };

    const weights = {
        ...RULE_WEIGHTS,
        ...(options.weights || {}),
    };

    return {
        rules,
        weights,
        scoringVersion:
            options.scoringVersion ||
            SCORING_VERSION,
    };
}


/**
 * ============================================================================
 * Rule Evaluation
 * ============================================================================
 */

function evaluateRules({
    amount,
    userAgeMinutes,
    transactionCount,
    locationMismatch,
    rules,
    weights,
}) {
    const triggeredRules = [];

    let score = 0;

    /**
     * Large transaction
     */
    if (
        amount >
        rules.LARGE_TX_AMOUNT
    ) {
        const points =
            weights.LARGE_TRANSACTION;

        score += points;

        triggeredRules.push({
            code:
                'LARGE_TRANSACTION',

            category:
                'TRANSACTION_AMOUNT',

            points,

            evidence: {
                amount,
                threshold:
                    rules.LARGE_TX_AMOUNT,
            },

            reason:
                'Transaction amount exceeds configured threshold.',
        });
    }

    /**
     * New account
     */
    if (
        userAgeMinutes <
        rules.NEW_ACCOUNT_MINUTES
    ) {
        const points =
            weights.NEW_ACCOUNT;

        score += points;

        triggeredRules.push({
            code:
                'NEW_ACCOUNT',

            category:
                'ACCOUNT_AGE',

            points,

            evidence: {
                userAgeMinutes,
                threshold:
                    rules.NEW_ACCOUNT_MINUTES,
            },

            reason:
                'Account age is below configured minimum.',
        });
    }

    /**
     * Transaction velocity
     */
    if (
        transactionCount >
        rules.HIGH_TX_COUNT
    ) {
        const points =
            weights.HIGH_VELOCITY;

        score += points;

        triggeredRules.push({
            code:
                'HIGH_TRANSACTION_VELOCITY',

            category:
                'VELOCITY',

            points,

            evidence: {
                transactionCount,
                threshold:
                    rules.HIGH_TX_COUNT,
            },

            reason:
                'Transaction velocity exceeds configured threshold.',
        });
    }

    /**
     * Location anomaly
     */
    if (locationMismatch) {
        const points =
            weights.LOCATION_MISMATCH;

        score += points;

        triggeredRules.push({
            code:
                'LOCATION_MISMATCH',

            category:
                'LOCATION',

            points,

            evidence: {
                locationMismatch: true,
            },

            reason:
                'Transaction location differs from expected location.',
        });
    }

    return {
        rawScore:
            score,

        score:
            Math.min(
                Math.max(score, 0),
                MAX_SCORE
            ),

        triggeredRules,
    };
}


/**
 * ============================================================================
 * Decision Engine
 * ============================================================================
 */

function getDecision(score) {
    const normalizedScore =
        normalizeNumber(score, 0);

    if (normalizedScore < 40) {
        return DECISIONS.APPROVE;
    }

    if (normalizedScore < 80) {
        return DECISIONS.REVIEW;
    }

    return DECISIONS.BLOCK;
}


/**
 * ============================================================================
 * Risk Classification
 * ============================================================================
 */

function getRiskLevel(score) {
    if (score < 40) {
        return 'LOW';
    }

    if (score < 80) {
        return 'MEDIUM';
    }

    return 'HIGH';
}


/**
 * ============================================================================
 * Metrics
 * ============================================================================
 */

function incrementMetric(metrics, name, labels) {
    try {
        metrics?.counter?.(
            name,
            labels
        );
    } catch (error) {
        logger?.warn?.({
            message:
                'Risk metrics publication failed',

            metric:
                name,

            error:
                error.message,
        });
    }
}


/**
 * ============================================================================
 * Core Risk Calculation
 * ============================================================================
 */

function calculateRiskScore(
    {
        amount = 0,
        userAgeMinutes = 0,
        transactionCount = 0,
        locationMismatch = false,
    } = {},
    options = {}
) {
    const normalized = {
        amount:
            normalizeNumber(amount),

        userAgeMinutes:
            normalizeNumber(
                userAgeMinutes
            ),

        transactionCount:
            normalizeNumber(
                transactionCount
            ),

        locationMismatch:
            normalizeBoolean(
                locationMismatch
            ),
    };

    const configuration =
        resolveConfiguration(
            options
        );

    const result =
        evaluateRules({
            ...normalized,

            rules:
                configuration.rules,

            weights:
                configuration.weights,
        });

    return result.score;
}


/**
 * ============================================================================
 * Full Transaction Evaluation
 * ============================================================================
 */

function evaluateTransaction(
    data = {},
    options = {}
) {
    const correlationId =
        data.correlationId ||
        generateCorrelationId();

    const startedAt =
        Date.now();

    statistics.evaluations++;

    try {
        validateTransactionInput(data);

        const configuration =
            resolveConfiguration(
                options
            );

        const canonicalInput =
            buildCanonicalInput(data);

        const inputFingerprint =
            createInputFingerprint(
                canonicalInput
            );

        const rulesResult =
            evaluateRules({
                amount:
                    canonicalInput.amount,

                userAgeMinutes:
                    canonicalInput.userAgeMinutes,

                transactionCount:
                    canonicalInput.transactionCount,

                locationMismatch:
                    canonicalInput.locationMismatch,

                rules:
                    configuration.rules,

                weights:
                    configuration.weights,
            });

        const score =
            rulesResult.score;

        const decision =
            getDecision(score);

        const riskLevel =
            getRiskLevel(score);

        if (decision === DECISIONS.APPROVE) {
            statistics.approved++;
        } else if (
            decision === DECISIONS.REVIEW
        ) {
            statistics.reviewed++;
        } else {
            statistics.blocked++;
        }

        const result = {
            provider:
                PROVIDER,

            service:
                'risk-scoring',

            scoringVersion:
                configuration.scoringVersion,

            correlationId,

            tenantId:
                canonicalInput.tenantId,

            inputFingerprint,

            baseScore:
                0,

            score,

            riskLevel,

            decision,

            triggeredRules:
                rulesResult.triggeredRules,

            ruleCount:
                rulesResult.triggeredRules.length,

            durationMs:
                Date.now() - startedAt,

            evaluatedAt:
                new Date(),
        };

        incrementMetric(
            options.metrics,
            'risk_evaluations_total',
            {
                tenantId:
                    canonicalInput.tenantId || 'unknown',

                decision,

                scoringVersion:
                    configuration.scoringVersion,
            }
        );

        incrementMetric(
            options.metrics,
            'risk_score_decision_total',
            {
                decision,
                riskLevel,
            }
        );

        options.logger?.info?.({
            message:
                'Risk transaction evaluated',

            tenantId:
                canonicalInput.tenantId,

            correlationId,

            scoringVersion:
                configuration.scoringVersion,

            inputFingerprint,

            score,

            decision,

            riskLevel,

            ruleCount:
                rulesResult.triggeredRules.length,

            durationMs:
                result.durationMs,
        });

        return result;
    } catch (error) {
        statistics.failures++;

        options.metrics?.counter?.(
            'risk_evaluation_failures_total'
        );

        options.logger?.error?.({
            message:
                'Risk evaluation failed',

            tenantId:
                data?.tenantId,

            correlationId,

            error:
                error?.message,

            errorName:
                error?.name,
        });

        throw error;
    }
}


/**
 * ============================================================================
 * Service Factory
 * ============================================================================
 *
 * Allows the risk engine to be configured per tenant/environment without
 * changing the public calculation API.
 */

function createRiskService({
    logger: serviceLogger = logger,
    metrics = null,
    configuration = {},
} = {}) {
    return Object.freeze({
        evaluateTransaction(data = {}) {
            return evaluateTransaction(
                data,
                {
                    ...configuration,
                    logger: serviceLogger,
                    metrics,
                }
            );
        },

        calculateRiskScore(data = {}) {
            return calculateRiskScore(
                data,
                configuration
            );
        },

        getDecision,

        getRiskLevel,

        getConfiguration() {
            return resolveConfiguration(
                configuration
            );
        },

        health() {
            return {
                provider:
                    PROVIDER,

                component:
                    'risk-scoring',

                status:
                    'UP',

                scoringVersion:
                    configuration.scoringVersion ||
                    SCORING_VERSION,

                statistics:
                    {
                        ...statistics,
                    },
            };
        },

        stats() {
            return {
                ...statistics,
            };
        },
    });
}


/**
 * ============================================================================
 * Health
 * ============================================================================
 */

function health() {
    return {
        provider:
            PROVIDER,

        component:
            'risk-scoring',

        status:
            'UP',

        scoringVersion:
            SCORING_VERSION,

        statistics: {
            ...statistics,
        },
    };
}


/**
 * ============================================================================
 * Diagnostics
 * ============================================================================
 */

function stats() {
    return {
        ...statistics,
    };
}


/**
 * ============================================================================
 * Exports
 * ============================================================================
 */

module.exports = {
    evaluateTransaction,

    calculateRiskScore,

    getDecision,

    getRiskLevel,

    validateTransactionInput,

    createInputFingerprint,

    buildCanonicalInput,

    createRiskService,

    resolveConfiguration,

    health,

    stats,

    RISK_RULES,

    RULE_WEIGHTS,

    DECISIONS,

    SCORING_VERSION,
};