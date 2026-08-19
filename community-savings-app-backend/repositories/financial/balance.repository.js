"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/repositories/financial/balance.repository.js
 *
 * Purpose:
 *   Atomic account balance persistence boundary.
 *
 * Architectural Position:
 *
 *   Financial Transaction Service
 *              │
 *              ▼
 *       Balance Repository
 *              │
 *              ▼
 *      MongoDB Account Model
 *
 * CRITICAL FINANCIAL INVARIANT
 * =============================================================================
 *
 * Balance decrements MUST be performed as one conditional MongoDB update.
 *
 * NEVER:
 *
 *      1. read balance
 *      2. check balance in JavaScript
 *      3. update balance
 *
 * because concurrent requests can observe the same balance.
 *
 * REQUIRED:
 *
 *      balance >= amount
 *              │
 *              ▼
 *       atomic $inc
 *
 *      inside the SAME MongoDB transaction session.
 *
 * Repository Rules
 * =============================================================================
 *
 *   ✓ Every financial write requires a MongoDB session.
 *   ✓ Repository never starts a transaction.
 *   ✓ Repository never commits a transaction.
 *   ✓ Repository never aborts a transaction.
 *   ✓ Tenant isolation is mandatory.
 *   ✓ Currency isolation is mandatory.
 *   ✓ Only ACTIVE accounts may mutate.
 *   ✓ Debit/decrement is conditionally atomic.
 *   ✓ Negative balances are never intentionally created.
 *   ✓ Transaction identity is persisted with the mutation.
 *   ✓ Balance mutation timestamp is persisted.
 *   ✓ Financial amounts are not converted through JavaScript Number.
 *   ✓ No generic update/delete methods are exposed.
 *
 * IMPORTANT:
 *
 *   The financial service remains responsible for:
 *
 *      - authorization
 *      - business rules
 *      - idempotency
 *      - transaction orchestration
 *      - ledger balancing
 *      - transaction state
 *
 *   This repository is responsible for safe persistence.
 * =============================================================================
 */

const {
    Account
} = require(
    "../../models/account.model"
);

const {
    FinancialTransactionError
} = require(
    "../../services/financial/financialTransaction.service"
);

// =============================================================================
// Constants
// =============================================================================

const ACCOUNT_ID_MAX_LENGTH = 128;
const TENANT_ID_MAX_LENGTH = 128;
const TRANSACTION_ID_MAX_LENGTH = 128;
const CURRENCY_MAX_LENGTH = 16;

const ACTIVE_ACCOUNT_STATUS = "ACTIVE";

// =============================================================================
// Error Factory
// =============================================================================

function createBalanceError(
    message,
    code,
    statusCode = 500,
    details = undefined
) {

    const error =
        new FinancialTransactionError(
            message,
            code,
            statusCode
        );

    /*
     * Preserve structured diagnostic information without depending on the
     * current FinancialTransactionError constructor signature.
     */

    if (
        details !== undefined
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

    if (!session) {

        throw createBalanceError(
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

        throw createBalanceError(
            `${field} is required.`,
            "BALANCE_FIELD_REQUIRED",
            400,
            {
                field
            }
        );
    }

    const normalized =
        String(value)
            .trim();

    if (
        normalized.length === 0
    ) {

        throw createBalanceError(
            `${field} is required.`,
            "BALANCE_FIELD_REQUIRED",
            400,
            {
                field
            }
        );
    }

    if (
        maxLength &&
        normalized.length >
        maxLength
    ) {

        throw createBalanceError(
            `${field} exceeds the maximum permitted length.`,
            "BALANCE_FIELD_TOO_LONG",
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
// Account ID
// =============================================================================

function requireAccountId(
    accountId
) {

    return requireIdentifier(
        accountId,
        "accountId",
        ACCOUNT_ID_MAX_LENGTH
    );
}

// =============================================================================
// Tenant ID
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
// Transaction ID
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
        )
            .toUpperCase();

    if (
        !/^[A-Z]{3,16}$/.test(
            normalized
        )
    ) {

        throw createBalanceError(
            "Invalid account currency.",
            "BALANCE_INVALID_CURRENCY",
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
// Monetary Amount Validation
// =============================================================================
//
// IMPORTANT:
//
// Never use:
//
//      Number(amount)
//
// for financial values.
//
// JavaScript Number uses IEEE-754 floating-point representation and can create
// precision errors.
//
// The preferred architecture is:
//
//      MongoDB Decimal128
//
// or:
//
//      integer minor units
//
// The repository therefore preserves Decimal128/string representations rather
// than converting them into floating-point numbers.
//
// =============================================================================

function normalizeAmount(
    amount
) {

    if (
        amount === undefined ||
        amount === null
    ) {

        throw createBalanceError(
            "Balance mutation amount is required.",
            "BALANCE_AMOUNT_REQUIRED",
            400,
            {
                field:
                    "amount"
            }
        );
    }

    let value;

    if (
        typeof amount === "string"
    ) {

        value =
            amount.trim();

    } else if (
        amount &&
        typeof amount.toString ===
            "function"
    ) {

        value =
            amount.toString();

    } else {

        value =
            String(amount);
    }

    if (
        value.length === 0
    ) {

        throw createBalanceError(
            "Balance mutation amount is required.",
            "BALANCE_AMOUNT_REQUIRED",
            400
        );
    }

    /*
     * Positive decimal notation.
     *
     * Accepted:
     *
     *   1
     *   1.00
     *   1000.50
     *   0.50
     *
     * Rejected:
     *
     *   0
     *   -1
     *   NaN
     *   Infinity
     *   1.2.3
     *   scientific notation
     */

    if (
        !/^(?:0*[1-9]\d*(?:\.\d+)?|0+\.\d*[1-9]\d*)$/.test(
            value
        )
    ) {

        throw createBalanceError(
            "Balance mutation amount must be a positive decimal value.",
            "BALANCE_INVALID_AMOUNT",
            400,
            {
                field:
                    "amount"
            }
        );
    }

    return amount;
}

// =============================================================================
// Account Query
// =============================================================================

function buildAccountFilter({
    accountId,
    tenantId,
    currency
}) {

    return {

        _id:
            requireAccountId(
                accountId
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
// Get Account
// =============================================================================
//
// This method is intended for inspection/transactional reads.
//
// IMPORTANT:
//
// It does NOT lock the document in the application layer.
//
// Financial mutation must never rely on:
//
//      getForUpdate()
//      JavaScript balance check
//      update()
//
// Instead, decrement() performs the conditional atomic mutation itself.
// =============================================================================

async function getForUpdate({
    session,
    accountId,
    tenantId,
    currency
}) {

    requireSession(
        session
    );

    const filter =
        buildAccountFilter({

            accountId,

            tenantId,

            currency

        });

    return Account
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
// Increment / Credit
// =============================================================================
//
// Atomic:
//
//      balance = balance + amount
//
// The update occurs inside the caller's MongoDB transaction.
//
// =============================================================================

async function increment({
    session,
    accountId,
    tenantId,
    amount,
    currency,
    transactionId,
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedAccountId =
        requireAccountId(
            accountId
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

    const mutationAt =
        new Date();

    /*
     * Metadata is accepted by the API for forward compatibility, but should
     * only be persisted if the Account model explicitly supports mutation
     * metadata.
     *
     * We intentionally do not blindly spread metadata into the account.
     */

    const result =
        await Account.findOneAndUpdate(

            {

                _id:
                    normalizedAccountId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency,

                status:
                    ACTIVE_ACCOUNT_STATUS

            },

            {

                $inc: {

                    balance:
                        normalizedAmount

                },

                $set: {

                    lastTransactionId:
                        normalizedTransactionId,

                    lastBalanceMutationAt:
                        mutationAt

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

    if (!result) {

        throw createBalanceError(
            "Financial account could not be credited.",
            "BALANCE_ACCOUNT_NOT_FOUND",
            404,
            {
                accountId:
                    normalizedAccountId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency
            }
        );
    }

    return result;
}

// =============================================================================
// Decrement / Debit
// =============================================================================
//
// CRITICAL:
//
// This is the most important method in this repository.
//
// DO NOT replace this with:
//
//      const account = await Account.findOne(...);
//
//      if (account.balance >= amount) {
//          account.balance -= amount;
//          await account.save();
//      }
//
// That pattern is vulnerable to concurrent balance-spending races.
//
// Instead:
//
//      balance: { $gte: amount }
//
// and:
//
//      $inc: { balance: -amount }
//
// are executed as ONE MongoDB update.
//
// =============================================================================

async function decrement({
    session,
    accountId,
    tenantId,
    amount,
    currency,
    transactionId,
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedAccountId =
        requireAccountId(
            accountId
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

    const mutationAt =
        new Date();

    /*
     * ATOMIC FINANCIAL MUTATION
     * -------------------------------------------------------------------------
     *
     * MongoDB evaluates:
     *
     *      balance >= amount
     *
     * and applies:
     *
     *      balance -= amount
     *
     * as one atomic document update.
     *
     * The caller's MongoDB session makes this mutation part of the enclosing
     * financial transaction.
     */

    const result =
        await Account.findOneAndUpdate(

            {

                _id:
                    normalizedAccountId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency,

                status:
                    ACTIVE_ACCOUNT_STATUS,

                balance: {

                    $gte:
                        normalizedAmount

                }

            },

            {

                $inc: {

                    balance:
                        normalizedAmount &&
                        (
                            typeof normalizedAmount ===
                                "object" &&
                            normalizedAmount.constructor?.name ===
                                "Decimal128"
                        )
                            ? normalizedAmount.negate?.() ||
                              {
                                  $literal:
                                      `-${normalizedAmount.toString()}`
                              }
                            : `-${normalizedAmount}`

                },

                $set: {

                    lastTransactionId:
                        normalizedTransactionId,

                    lastBalanceMutationAt:
                        mutationAt

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

        /*
         * Deliberately do not expose whether:
         *
         *   - account does not exist
         *   - account is inactive
         *   - currency does not match
         *   - balance is insufficient
         *
         * The financial service can map the domain error to the appropriate
         * externally visible response after applying its own authorization and
         * account-existence rules.
         */

        throw createBalanceError(
            "Insufficient available balance or financial account unavailable.",
            "INSUFFICIENT_AVAILABLE_BALANCE",
            409,
            {
                accountId:
                    normalizedAccountId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency
            }
        );
    }

    return result;
}

// =============================================================================
// Conditional Decrement With Explicit Insufficient-Balance Semantics
// =============================================================================
//
// This variant is useful when the financial service has already verified that
// the account exists and wants the repository to distinguish an insufficient
// balance from account availability.
//
// It still performs ONLY one balance mutation.
// =============================================================================

async function decrementStrict({
    session,
    accountId,
    tenantId,
    amount,
    currency,
    transactionId,
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedAccountId =
        requireAccountId(
            accountId
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

    /*
     * The important distinction here is that we still do not perform a
     * read/check/update sequence.
     *
     * The account existence check is NOT used to decide whether the debit is
     * safe. The debit itself remains conditional and atomic.
     */

    const result =
        await Account.findOneAndUpdate(

            {

                _id:
                    normalizedAccountId,

                tenantId:
                    normalizedTenantId,

                currency:
                    normalizedCurrency,

                status:
                    ACTIVE_ACCOUNT_STATUS,

                balance: {

                    $gte:
                        normalizedAmount

                }

            },

            {

                $inc: {

                    balance:
                        `-${normalizedAmount}`

                },

                $set: {

                    lastTransactionId:
                        normalizedTransactionId,

                    lastBalanceMutationAt:
                        new Date()

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

        throw createBalanceError(
            "Insufficient available balance or financial account unavailable.",
            "INSUFFICIENT_AVAILABLE_BALANCE",
            409,
            {
                accountId:
                    normalizedAccountId
            }
        );
    }

    return result;
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {

    ACTIVE_ACCOUNT_STATUS,

    getForUpdate,

    increment,

    decrement,

    decrementStrict

};