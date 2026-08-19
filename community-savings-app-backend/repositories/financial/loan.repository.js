"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/repositories/financial/loan.repository.js
 *
 * Purpose:
 *   Session-aware persistence boundary for loan financial mutations.
 *
 * Architectural Position:
 *
 *   Financial Transaction Service
 *              │
 *              ▼
 *        Loan Repository
 *              │
 *              ▼
 *          Loan Model
 *
 * Repository Guarantees
 * =============================================================================
 *
 *   ✓ Every mutation requires a MongoDB session.
 *   ✓ Tenant isolation is enforced.
 *   ✓ Currency isolation is enforced.
 *   ✓ Disbursement is atomic.
 *   ✓ Repayment is atomic.
 *   ✓ Repayment cannot exceed outstanding principal.
 *   ✓ Disbursement cannot exceed principal.
 *   ✓ Decimal128 is used for all monetary arithmetic.
 *   ✓ Financial transaction identity is persisted.
 *   ✓ Lifecycle transitions are constrained.
 *   ✓ Repository never starts a transaction.
 *   ✓ Repository never commits a transaction.
 *   ✓ Repository never aborts a transaction.
 *   ✓ Repository never performs authorization.
 *   ✓ Repository never implements idempotency.
 *
 * CRITICAL:
 *
 *   Financial arithmetic MUST remain inside MongoDB.
 *
 *   Never:
 *
 *       Number(amount)
 *       parseFloat(amount)
 *       parseInt(amount)
 *
 * =============================================================================
 */

const mongoose =
    require("mongoose");

const {
    Loan
} = require(
    "../../models/loan.model"
);

const {
    FinancialTransactionError
} = require(
    "../../services/financial/financialTransaction.service"
);

// =============================================================================
// Constants
// =============================================================================

const LOAN_ID_MAX_LENGTH =
    128;

const TENANT_ID_MAX_LENGTH =
    128;

const TRANSACTION_ID_MAX_LENGTH =
    128;

const CURRENCY_MAX_LENGTH =
    16;

const DISBURSEMENT_STATUS =
    "APPROVED";

const DISBURSED_STATUS =
    "DISBURSED";

const ACTIVE_STATUS =
    "ACTIVE";

const PARTIALLY_REPAID_STATUS =
    "PARTIALLY_REPAID";

const REPAID_STATUS =
    "REPAID";

// =============================================================================
// Error Factory
// =============================================================================

function createLoanError(
    message,
    code,
    statusCode = 500,
    details = undefined
) {

    const error =
        new FinancialTransactionError(
            message,
            code,
            statusCode,
            details
        );

    if (
        details !== undefined &&
        error.details === undefined
    ) {

        error.details =
            details;

    }

    return error;
}

// =============================================================================
// Session Validation
// =============================================================================

function requireSession(
    session
) {

    if (
        !session ||
        typeof session.inTransaction !==
        "function"
    ) {

        throw createLoanError(
            "MongoDB transaction session is required.",
            "FINANCIAL_SESSION_REQUIRED",
            500
        );

    }

    return session;
}

// =============================================================================
// Identifier Validation
// =============================================================================

function requireIdentifier(
    value,
    field,
    maxLength
) {

    if (
        value === undefined ||
        value === null
    ) {

        throw createLoanError(
            `${field} is required.`,
            "LOAN_FIELD_REQUIRED",
            400,
            {
                field
            }
        );

    }

    const normalized =
        String(value).trim();

    if (
        normalized.length === 0
    ) {

        throw createLoanError(
            `${field} is required.`,
            "LOAN_FIELD_REQUIRED",
            400,
            {
                field
            }
        );

    }

    if (
        maxLength &&
        normalized.length > maxLength
    ) {

        throw createLoanError(
            `${field} exceeds the maximum permitted length.`,
            "LOAN_FIELD_TOO_LONG",
            400,
            {
                field,
                maxLength
            }
        );

    }

    return normalized;
}

// =============================================================================
// Loan Identifier
// =============================================================================

function requireLoanId(
    loanAccountId
) {

    return requireIdentifier(
        loanAccountId,
        "loanAccountId",
        LOAN_ID_MAX_LENGTH
    );
}

// =============================================================================
// Tenant Identifier
// =============================================================================

function requireTenantId(
    tenantId
) {

    return requireIdentifier(
        tenantId,
        "tenantId",
        TENANT_ID_MAX_LENGTH
    );
}

// =============================================================================
// Transaction Identifier
// =============================================================================

function requireTransactionId(
    transactionId
) {

    return requireIdentifier(
        transactionId,
        "transactionId",
        TRANSACTION_ID_MAX_LENGTH
    );
}

// =============================================================================
// Currency
// =============================================================================

function requireCurrency(
    currency
) {

    const normalized =
        requireIdentifier(
            currency,
            "currency",
            CURRENCY_MAX_LENGTH
        ).toUpperCase();

    if (
        !/^[A-Z]{3,16}$/.test(
            normalized
        )
    ) {

        throw createLoanError(
            "Invalid loan currency.",
            "LOAN_INVALID_CURRENCY",
            400,
            {
                currency:
                    normalized
            }
        );

    }

    return normalized;
}

// =============================================================================
// Decimal128 Detection
// =============================================================================

function isDecimal128(
    value
) {

    return Boolean(

        value &&

        (
            value instanceof
            mongoose.Types.Decimal128
        )

    );
}

// =============================================================================
// Decimal128 Normalization
// =============================================================================
//
// IMPORTANT:
//
// The repository accepts Decimal128 or a canonical decimal string.
//
// The normalized value returned here is ALWAYS Decimal128.
//
// No JavaScript Number conversion is permitted.
//
// =============================================================================

function normalizeAmount(
    amount
) {

    if (
        amount === undefined ||
        amount === null
    ) {

        throw createLoanError(
            "Loan amount is required.",
            "LOAN_AMOUNT_REQUIRED",
            400
        );

    }

    const value =
        isDecimal128(amount)
            ? amount.toString()
            : String(amount).trim();

    /*
     * Positive monetary value.
     *
     * Examples:
     *
     *   1
     *   10
     *   10.00
     *   1000.50
     *   0.50
     *
     * Rejected:
     *
     *   0
     *   -10
     *   +10
     *   1e5
     *   NaN
     *   Infinity
     *   1.2.3
     */

    if (
        !/^(?:0*[1-9]\d*(?:\.\d+)?|0+\.\d*[1-9]\d*)$/.test(
            value
        )
    ) {

        throw createLoanError(
            "Loan amount must be a positive decimal value.",
            "LOAN_INVALID_AMOUNT",
            400
        );

    }

    try {

        return mongoose.Types.Decimal128
            .fromString(
                value
            );

    } catch (
    error
    ) {

        throw createLoanError(
            "Loan amount is not a valid monetary value.",
            "LOAN_INVALID_AMOUNT",
            400
        );

    }
}

// =============================================================================
// Decimal Zero
// =============================================================================

function decimalZero() {

    return mongoose.Types.Decimal128
        .fromString(
            "0"
        );
}

// =============================================================================
// Decimal Negative
// =============================================================================

function decimalNegative(
    decimal
) {

    if (
        !isDecimal128(decimal)
    ) {

        throw createLoanError(
            "Amount must be Decimal128.",
            "LOAN_INVALID_DECIMAL",
            500
        );

    }

    const value =
        decimal.toString();

    if (
        value.startsWith("-")
    ) {

        return decimal;

    }

    return mongoose.Types.Decimal128
        .fromString(
            `-${value}`
        );
}

// =============================================================================
// Decimal Zero Check
// =============================================================================

function isZeroDecimal(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return false;
    }

    return /^0(?:\.0+)?$/.test(
        value.toString()
    );
}

// =============================================================================
// Common Loan Filter
// =============================================================================

function buildLoanFilter({
    loanAccountId,
    tenantId,
    currency
}) {

    return {

        _id:
            requireLoanId(
                loanAccountId
            ),

        tenantId:
            requireTenantId(
                tenantId
            ),

        currency:
            requireCurrency(
                currency
            )

    };
}

// =============================================================================
// Find Loan
// =============================================================================

async function findById({
    session,
    loanAccountId,
    tenantId,
    currency
}) {

    requireSession(
        session
    );

    const filter =
        buildLoanFilter({

            loanAccountId,

            tenantId,

            currency

        });

    return Loan
        .findOne(
            filter
        )
        .session(
            session
        )
        .lean()
        .exec();
}

// =============================================================================
// Disburse
// =============================================================================
//
// Atomic transition:
//
//     APPROVED
//        │
//        ▼
//     DISBURSED
//
// Monetary invariant:
//
//     disbursedAmount + requestedAmount
//                         <=
//                    principalAmount
//
// Mutation:
//
//     disbursedAmount   += requestedAmount
//     outstandingAmount += requestedAmount
//
// No JavaScript balance calculation occurs.
//
// =============================================================================

async function disburse({
    session,
    loanAccountId,
    tenantId,
    amount,
    currency,
    transactionId,
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedLoanId =
        requireLoanId(
            loanAccountId
        );

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const normalizedCurrency =
        requireCurrency(
            currency
        );

    const normalizedTransactionId =
        requireTransactionId(
            transactionId
        );

    const normalizedAmount =
        normalizeAmount(
            amount
        );

    const now =
        new Date();

    /*
     * Decimal128 is passed directly into the MongoDB expression.
     *
     * MongoDB therefore performs:
     *
     *     Decimal128 + Decimal128
     *
     * rather than:
     *
     *     JavaScript Number + Number
     */

    const result =
        await Loan.findOneAndUpdate(

            {

                _id:
                    normalizedLoanId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency,

                status:
                    DISBURSEMENT_STATUS,

                $expr: {

                    $lte: [

                        {

                            $add: [

                                "$disbursedAmount",

                                normalizedAmount

                            ]

                        },

                        "$principalAmount"

                    ]

                }

            },

            {

                $inc: {

                    disbursedAmount:
                        normalizedAmount,

                    outstandingAmount:
                        normalizedAmount

                },

                $set: {

                    status:
                        DISBURSED_STATUS,

                    disbursedAt:
                        now,

                    lastTransactionId:
                        normalizedTransactionId,

                    lastFinancialMutationAt:
                        now

                }

            },

            {

                new:
                    true,

                session,

                runValidators:
                    true

            }

        )
            .lean()
            .exec();

    if (
        !result
    ) {

        throw createLoanError(

            "Loan is unavailable for disbursement or the requested amount exceeds the remaining approved principal.",

            "LOAN_DISBURSEMENT_NOT_ALLOWED",

            409,

            {

                loanAccountId:
                    normalizedLoanId

            }

        );

    }

    return result;
}

// =============================================================================
// Repayment
// =============================================================================
//
// Atomic repayment invariant:
//
//     outstandingAmount >= repaymentAmount
//
// Mutation:
//
//     outstandingAmount -= repaymentAmount
//     repaidAmount      += repaymentAmount
//
// Lifecycle:
//
//     outstanding = 0
//             │
//             ▼
//          REPAID
//
//     outstanding > 0
//             │
//             ▼
//      PARTIALLY_REPAID
//
// IMPORTANT:
//
// The status decision is made by MongoDB using the post-mutation expression.
// There is no second read-modify-write cycle.
//
// =============================================================================

async function repay({
    session,
    loanAccountId,
    tenantId,
    amount,
    currency,
    transactionId,
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedLoanId =
        requireLoanId(
            loanAccountId
        );

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const normalizedCurrency =
        requireCurrency(
            currency
        );

    const normalizedTransactionId =
        requireTransactionId(
            transactionId
        );

    const normalizedAmount =
        normalizeAmount(
            amount
        );

    const negativeAmount =
        decimalNegative(
            normalizedAmount
        );

    const now =
        new Date();

    /*
     * IMPORTANT:
     *
     * MongoDB evaluates the outstanding balance predicate atomically.
     *
     * Therefore concurrent repayments cannot both consume the same
     * outstanding principal.
     */

    const result =
        await Loan.findOneAndUpdate(

            {

                _id:
                    normalizedLoanId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency,

                status: {

                    $in: [

                        DISBURSED_STATUS,

                        ACTIVE_STATUS,

                        PARTIALLY_REPAID_STATUS

                    ]

                },

                outstandingAmount: {

                    $gte:
                        normalizedAmount

                }

            },

            [

                // =============================================================
                // Stage 1
                // =============================================================

                {

                    $set: {

                        outstandingAmount: {

                            $subtract: [

                                "$outstandingAmount",

                                normalizedAmount

                            ]

                        },

                        repaidAmount: {

                            $add: [

                                "$repaidAmount",

                                normalizedAmount

                            ]

                        },

                        lastTransactionId:
                            normalizedTransactionId,

                        lastRepaymentAt:
                            now,

                        lastFinancialMutationAt:
                            now

                    }

                },

                // =============================================================
                // Stage 2
                // =============================================================
                //
                // Determine lifecycle state from the post-repayment
                // outstanding amount.
                //
                // =============================================================

                {

                    $set: {

                        status: {

                            $cond: [

                                {

                                    $eq: [

                                        "$outstandingAmount",

                                        decimalZero()

                                    ]

                                },

                                REPAID_STATUS,

                                PARTIALLY_REPAID_STATUS

                            ]

                        },

                        repaidAt: {

                            $cond: [

                                {

                                    $eq: [

                                        "$outstandingAmount",

                                        decimalZero()

                                    ]

                                },

                                now,

                                "$repaidAt"

                            ]

                        }

                    }

                }

            ],

            {

                new:
                    true,

                session,

                runValidators:
                    true

            }

        )
            .lean()
            .exec();

    if (
        !result
    ) {

        throw createLoanError(

            "Loan repayment exceeds the outstanding loan balance or the loan is unavailable.",

            "LOAN_REPAYMENT_NOT_ALLOWED",

            409,

            {

                loanAccountId:
                    normalizedLoanId

            }

        );

    }

    return result;
}

// =============================================================================
// Mark Active
// =============================================================================
//
// Lifecycle transition:
//
//     DISBURSED
//          │
//          ▼
//        ACTIVE
//
// =============================================================================

async function markActive({
    session,
    loanAccountId,
    tenantId,
    currency,
    transactionId
}) {

    requireSession(
        session
    );

    const normalizedLoanId =
        requireLoanId(
            loanAccountId
        );

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const normalizedCurrency =
        requireCurrency(
            currency
        );

    const normalizedTransactionId =
        requireTransactionId(
            transactionId
        );

    const now =
        new Date();

    const result =
        await Loan.findOneAndUpdate(

            {

                _id:
                    normalizedLoanId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency,

                status:
                    DISBURSED_STATUS

            },

            {

                $set: {

                    status:
                        ACTIVE_STATUS,

                    lastTransactionId:
                        normalizedTransactionId,

                    lastFinancialMutationAt:
                        now

                }

            },

            {

                new:
                    true,

                session,

                runValidators:
                    true

            }

        )
            .lean()
            .exec();

    if (
        !result
    ) {

        throw createLoanError(

            "Loan cannot be activated from its current state.",

            "LOAN_ACTIVATION_NOT_ALLOWED",

            409,

            {

                loanAccountId:
                    normalizedLoanId

            }

        );

    }

    return result;
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {

    // Lifecycle constants

    DISBURSEMENT_STATUS,

    DISBURSED_STATUS,

    ACTIVE_STATUS,

    PARTIALLY_REPAID_STATUS,

    REPAID_STATUS,

    // Read

    findById,

    // Financial mutations

    disburse,

    repay,

    markActive

};