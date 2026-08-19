"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/repositories/financial/ledger.repository.js
 *
 * Purpose:
 *   Persistence boundary for immutable double-entry financial ledger entries.
 *
 * Architectural Responsibilities
 * ---------------------------------------------------------------------------
 *   ✓ Persist immutable ledger entries.
 *   ✓ Require an active MongoDB session for every write.
 *   ✓ Never start a MongoDB transaction.
 *   ✓ Never commit a MongoDB transaction.
 *   ✓ Never abort a MongoDB transaction.
 *   ✓ Enforce tenant ownership at the persistence boundary.
 *   ✓ Validate ledger entry identity and financial fields.
 *   ✓ Support atomic batch insertion.
 *   ✓ Convert MongoDB duplicate-key errors into domain errors.
 *   ✓ Prevent accidental update/delete semantics.
 *
 * Architectural Non-Responsibilities
 * ---------------------------------------------------------------------------
 *   ✗ Does not authorize users.
 *   ✗ Does not determine whether an account may transact.
 *   ✗ Does not mutate account balances.
 *   ✗ Does not calculate business-level transaction amounts.
 *   ✗ Does not start/commit/abort MongoDB transactions.
 *
 * IMPORTANT:
 *
 *   The financial transaction service/coordinator owns the MongoDB transaction.
 *
 *   This repository receives the session and participates in that transaction.
 *
 * Double-entry invariant:
 *
 *       SUM(CREDITS) === SUM(DEBITS)
 *
 *   This invariant should be validated by the financial transaction service
 *   before ledger entries are persisted.
 * =============================================================================
 */

const {
    LedgerEntry
} = require(
    "../../models/ledgerEntry.model"
);

const {
    FinancialTransactionError
} = require(
    "../../services/financial/financialTransaction.service"
);

// =============================================================================
// Constants
// =============================================================================

const LEDGER_DIRECTIONS =
    Object.freeze([
        "DEBIT",
        "CREDIT"
    ]);

const MAX_TRANSACTION_ID_LENGTH = 128;
const MAX_TENANT_ID_LENGTH = 128;
const MAX_ACCOUNT_ID_LENGTH = 128;
const MAX_ENTRY_TYPE_LENGTH = 128;
const MAX_CURRENCY_LENGTH = 16;

const MAX_BATCH_SIZE = 100;

// =============================================================================
// Error Factory
// =============================================================================

function createLedgerError(
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
     * Preserve structured diagnostic information without assuming that
     * FinancialTransactionError currently accepts a fourth constructor
     * parameter.
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

        throw createLedgerError(
            "MongoDB transaction session is required.",
            "FINANCIAL_SESSION_REQUIRED",
            500
        );
    }

    return session;
}

// =============================================================================
// Required Value Validation
// =============================================================================

function requireValue(
    value,
    field,
    {
        maxLength
    } = {}
) {

    if (
        value === undefined ||
        value === null
    ) {

        throw createLedgerError(
            `${field} is required.`,
            "LEDGER_FIELD_REQUIRED",
            400,
            {
                field
            }
        );
    }

    const normalized =
        typeof value === "string"
            ? value.trim()
            : value;

    if (
        normalized === ""
    ) {

        throw createLedgerError(
            `${field} is required.`,
            "LEDGER_FIELD_REQUIRED",
            400,
            {
                field
            }
        );
    }

    if (
        maxLength &&
        String(normalized).length >
        maxLength
    ) {

        throw createLedgerError(
            `${field} exceeds the maximum permitted length.`,
            "LEDGER_FIELD_TOO_LONG",
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
// Identifier Validation
// =============================================================================

function requireIdentifier(
    value,
    field,
    maxLength
) {

    const normalized =
        requireValue(
            value,
            field,
            {
                maxLength
            }
        );

    if (
        !/^[a-zA-Z0-9._:-]+$/.test(
            String(normalized)
        )
    ) {

        throw createLedgerError(
            `${field} contains invalid characters.`,
            "LEDGER_INVALID_IDENTIFIER",
            400,
            {
                field
            }
        );
    }

    return normalized;
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
        MAX_TRANSACTION_ID_LENGTH
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
        MAX_TENANT_ID_LENGTH
    );
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
        MAX_ACCOUNT_ID_LENGTH
    );
}

// =============================================================================
// Entry Type
// =============================================================================

function requireEntryType(
    entryType
) {

    return requireIdentifier(
        entryType,
        "entryType",
        MAX_ENTRY_TYPE_LENGTH
    );
}

// =============================================================================
// Currency
// =============================================================================

function requireCurrency(
    currency
) {

    const normalized =
        requireValue(
            currency,
            "currency",
            {
                maxLength:
                    MAX_CURRENCY_LENGTH
            }
        );

    const normalizedCurrency =
        String(
            normalized
        ).toUpperCase();

    /*
     * ISO-style currency codes are normally three letters.
     *
     * The upper bound allows future platform-specific currency identifiers
     * while rejecting malformed values.
     */

    if (
        !/^[A-Z]{3,16}$/.test(
            normalizedCurrency
        )
    ) {

        throw createLedgerError(
            "Invalid ledger currency.",
            "LEDGER_INVALID_CURRENCY",
            400,
            {
                currency:
                    normalizedCurrency
            }
        );
    }

    return normalizedCurrency;
}

// =============================================================================
// Direction
// =============================================================================

function requireDirection(
    direction
) {

    const normalized =
        String(
            requireValue(
                direction,
                "direction",
                {
                    maxLength:
                        16
                }
            )
        )
            .trim()
            .toUpperCase();

    if (
        !LEDGER_DIRECTIONS.includes(
            normalized
        )
    ) {

        throw createLedgerError(
            "Ledger direction must be DEBIT or CREDIT.",
            "LEDGER_INVALID_DIRECTION",
            400,
            {
                direction:
                    normalized
            }
        );
    }

    return normalized;
}

// =============================================================================
// Amount Validation
// =============================================================================
//
// IMPORTANT:
//   Do not convert financial values through Number() here.
//
// JavaScript Number is IEEE-754 floating point and can introduce precision
// errors.
//
// The canonical representation should be established by the model/service
// layer using Decimal128 or integer minor units.
//
// The repository therefore performs structural validation only and preserves
// the supplied value.
// =============================================================================

function requireAmount(
    amount
) {

    if (
        amount === undefined ||
        amount === null
    ) {

        throw createLedgerError(
            "Ledger amount is required.",
            "LEDGER_AMOUNT_REQUIRED",
            400,
            {
                field:
                    "amount"
            }
        );
    }

    /*
     * Decimal128 values expose a toString() representation.
     *
     * Strings are accepted because the financial service may deliberately
     * provide decimal values as strings to avoid floating-point conversion.
     */

    const value =
        typeof amount === "string"
            ? amount.trim()
            : amount?.toString
                ? amount.toString()
                : String(amount);

    if (
        !value
    ) {

        throw createLedgerError(
            "Ledger amount is required.",
            "LEDGER_AMOUNT_REQUIRED",
            400
        );
    }

    /*
     * Positive decimal amount.
     *
     * Examples accepted:
     *
     *   1
     *   1.00
     *   1000.50
     *
     * Examples rejected:
     *
     *   0
     *   -10
     *   1.2.3
     *   Infinity
     *   NaN
     */

    if (
        !/^(?:0*[1-9]\d*(?:\.\d+)?|0+\.\d*[1-9]\d*)$/.test(
            value
        )
    ) {

        throw createLedgerError(
            "Ledger amount must be a positive decimal value.",
            "LEDGER_INVALID_AMOUNT",
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
// Metadata
// =============================================================================

function normalizeMetadata(
    metadata
) {

    if (
        metadata === undefined ||
        metadata === null
    ) {

        return {};
    }

    if (
        typeof metadata !== "object" ||
        Array.isArray(metadata)
    ) {

        throw createLedgerError(
            "Ledger metadata must be an object.",
            "LEDGER_INVALID_METADATA",
            400,
            {
                field:
                    "metadata"
            }
        );
    }

    /*
     * Shallow clone prevents the caller from mutating the same root object
     * reference after repository invocation.
     *
     * The Mongoose schema should still impose its own schema/size limits.
     */

    return {
        ...metadata
    };
}

// =============================================================================
// Normalize Entry
// =============================================================================

function normalizeEntry(
    entry
) {

    if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry)
    ) {

        throw createLedgerError(
            "Ledger entry must be an object.",
            "LEDGER_INVALID_ENTRY",
            400
        );
    }

    const {

        transactionId,

        tenantId,

        accountId,

        amount,

        currency,

        entryType,

        direction,

        metadata = {}

    } = entry;

    return {

        transactionId:
            requireTransactionId(
                transactionId
            ),

        tenantId:
            requireTenantId(
                tenantId
            ),

        accountId:
            requireAccountId(
                accountId
            ),

        amount:
            requireAmount(
                amount
            ),

        currency:
            requireCurrency(
                currency
            ),

        entryType:
            requireEntryType(
                entryType
            ),

        direction:
            requireDirection(
                direction
            ),

        metadata:
            normalizeMetadata(
                metadata
            )

    };
}

// =============================================================================
// Tenant Consistency Validation
// =============================================================================
//
// A batch must never contain entries belonging to different tenants.
//
// This protects against accidental cross-tenant writes inside a single
// financial operation.
// =============================================================================

function requireSameTenant(
    entries
) {

    const firstTenantId =
        entries[0]?.tenantId;

    for (
        const entry of entries
    ) {

        if (
            entry.tenantId !==
            firstTenantId
        ) {

            throw createLedgerError(
                "All ledger entries in a batch must belong to the same tenant.",
                "LEDGER_TENANT_MISMATCH",
                400
            );
        }
    }

    return firstTenantId;
}

// =============================================================================
// Transaction Consistency Validation
// =============================================================================
//
// A batch represents one financial transaction.
//
// Therefore all entries must reference the same transaction ID.
// =============================================================================

function requireSameTransaction(
    entries
) {

    const firstTransactionId =
        entries[0]?.transactionId;

    for (
        const entry of entries
    ) {

        if (
            entry.transactionId !==
            firstTransactionId
        ) {

            throw createLedgerError(
                "All ledger entries in a batch must belong to the same financial transaction.",
                "LEDGER_TRANSACTION_MISMATCH",
                400
            );
        }
    }

    return firstTransactionId;
}

// =============================================================================
// Double-Entry Validation
// =============================================================================
//
// The repository does not calculate financial business rules, but it should
// protect the fundamental ledger invariant when creating a complete batch.
//
// For a complete double-entry transaction:
//
//     total debits === total credits
//
// IMPORTANT:
//   This function intentionally operates on decimal strings rather than
//   JavaScript Number values.
//
// For true arbitrary-precision financial arithmetic, the financial service
// should preferably provide Decimal128 values or a decimal arithmetic library.
// =============================================================================

function validateBalancedEntries(
    entries
) {

    let debitValues = [];
    let creditValues = [];

    for (
        const entry of entries
    ) {

        const value =
            entry.amount?.toString
                ? entry.amount.toString()
                : String(entry.amount);

        if (
            entry.direction === "DEBIT"
        ) {

            debitValues.push(
                value
            );

        } else {

            creditValues.push(
                value
            );
        }
    }

    if (
        debitValues.length === 0 ||
        creditValues.length === 0
    ) {

        throw createLedgerError(
            "A double-entry ledger transaction requires at least one debit and one credit.",
            "LEDGER_UNBALANCED_TRANSACTION",
            400
        );
    }

    /*
     * Avoid Number arithmetic.
     *
     * If Decimal128 is used by the model, compare Decimal128 values through
     * their canonical string representation using the financial service's
     * decimal implementation.
     *
     * For this repository, exact canonical decimal strings are normalized
     * below for comparison.
     */

    const normalizeDecimal =
        value => {

            let normalized =
                String(value)
                    .trim();

            if (
                normalized.includes("e") ||
                normalized.includes("E")
            ) {

                /*
                 * Scientific notation should be handled by the model/service
                 * decimal implementation rather than JavaScript Number.
                 */

                return normalized;
            }

            let [
                integerPart,
                fractionalPart = ""
            ] =
                normalized.split(".");

            integerPart =
                integerPart.replace(
                    /^0+(?=\d)/,
                    ""
                );

            fractionalPart =
                fractionalPart.replace(
                    /0+$/,
                    ""
                );

            return (
                fractionalPart
                    ? `${integerPart}.${fractionalPart}`
                    : integerPart
            );
        };

    /*
     * Exact decimal addition without floating-point arithmetic.
     */

    const addDecimals =
        values => {

            let scale = 0;

            const parsed =
                values.map(
                    value => {

                        const normalized =
                            String(value);

                        const [
                            integerPart,
                            fractionalPart = ""
                        ] =
                            normalized.split(".");

                        scale =
                            Math.max(
                                scale,
                                fractionalPart.length
                            );

                        return {
                            integerPart,
                            fractionalPart
                        };
                    }
                );

            let total = 0n;

            for (
                const value of parsed
            ) {

                const digits =
                    `${value.integerPart}${value.fractionalPart}`
                        .replace(
                            /^0+(?=\d)/,
                            ""
                        ) || "0";

                const padded =
                    digits.padEnd(
                        digits.length +
                        (
                            scale -
                            value.fractionalPart.length
                        ),
                        "0"
                    );

                total +=
                    BigInt(
                        padded
                    );
            }

            return total;
        };

    /*
     * BigInt allows exact integer arithmetic once decimal values are converted
     * to a common scale.
     *
     * Scientific notation is deliberately rejected here because it should be
     * represented by canonical Decimal128 values before reaching this layer.
     */

    if (
        debitValues.some(
            value =>
                /e/i.test(
                    String(value)
                )
        ) ||
        creditValues.some(
            value =>
                /e/i.test(
                    String(value)
                )
        )
    ) {

        throw createLedgerError(
            "Ledger amounts must use canonical decimal notation.",
            "LEDGER_NON_CANONICAL_AMOUNT",
            400
        );
    }

    const debits =
        debitValues.map(
            normalizeDecimal
        );

    const credits =
        creditValues.map(
            normalizeDecimal
        );

    if (
        addDecimals(debits) !==
        addDecimals(credits)
    ) {

        throw createLedgerError(
            "Ledger transaction is not balanced.",
            "LEDGER_UNBALANCED_TRANSACTION",
            400,
            {
                debitCount:
                    debits.length,

                creditCount:
                    credits.length
            }
        );
    }
}

// =============================================================================
// Create Single Entry
// =============================================================================

async function createEntry({
    session,
    transactionId,
    tenantId,
    accountId,
    amount,
    currency,
    entryType,
    direction,
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedEntry =
        normalizeEntry({

            transactionId,

            tenantId,

            accountId,

            amount,

            currency,

            entryType,

            direction,

            metadata

        });

    try {

        const [entry] =
            await LedgerEntry.create(

                [
                    normalizedEntry
                ],

                {
                    session
                }

            );

        return entry;

    } catch (error) {

        if (
            error?.code === 11000
        ) {

            throw createLedgerError(
                "Duplicate ledger entry detected.",
                "LEDGER_ENTRY_ALREADY_EXISTS",
                409,
                {
                    transactionId:
                        normalizedEntry.transactionId,

                    tenantId:
                        normalizedEntry.tenantId,

                    accountId:
                        normalizedEntry.accountId
                }
            );
        }

        throw error;
    }
}

// =============================================================================
// Create Multiple Entries
// =============================================================================

async function createEntries({
    session,
    entries,
    validateBalance = true
}) {

    requireSession(
        session
    );

    if (
        !Array.isArray(entries) ||
        entries.length === 0
    ) {

        throw createLedgerError(
            "At least one ledger entry is required.",
            "LEDGER_ENTRIES_REQUIRED",
            400
        );
    }

    if (
        entries.length >
        MAX_BATCH_SIZE
    ) {

        throw createLedgerError(
            `A maximum of ${MAX_BATCH_SIZE} ledger entries may be created in one batch.`,
            "LEDGER_BATCH_TOO_LARGE",
            400,
            {
                maxBatchSize:
                    MAX_BATCH_SIZE
            }
        );
    }

    const normalizedEntries =
        entries.map(
            normalizeEntry
        );

    requireSameTenant(
        normalizedEntries
    );

    requireSameTransaction(
        normalizedEntries
    );

    /*
     * Validate the fundamental double-entry invariant unless explicitly
     * disabled by a trusted internal workflow.
     *
     * For normal financial transactions this should remain true.
     */

    if (
        validateBalance
    ) {

        validateBalancedEntries(
            normalizedEntries
        );
    }

    try {

        const createdEntries =
            await LedgerEntry.insertMany(

                normalizedEntries,

                {
                    session,

                    ordered:
                        true
                }

            );

        return createdEntries;

    } catch (error) {

        if (
            error?.code === 11000
        ) {

            throw createLedgerError(
                "Duplicate ledger entry detected.",
                "LEDGER_ENTRY_ALREADY_EXISTS",
                409,
                {
                    transactionId:
                        normalizedEntries[0]
                            ?.transactionId
                }
            );
        }

        throw error;
    }
}

// =============================================================================
// Find Entries by Financial Transaction
// =============================================================================
//
// Reads may participate in an existing MongoDB transaction when a session is
// provided. They do not require a session because reads themselves do not
// mutate financial state.
// =============================================================================

async function findByTransactionId({
    session,
    transactionId,
    tenantId
}) {

    const normalizedTransactionId =
        requireTransactionId(
            transactionId
        );

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const query =
        LedgerEntry
            .find({

                transactionId:
                    normalizedTransactionId,

                tenantId:
                    normalizedTenantId

            })
            .sort({
                createdAt:
                    1
            });

    if (session) {

        query.session(
            session
        );
    }

    return query
        .lean()
        .exec();
}

// =============================================================================
// Find Entries by Account
// =============================================================================

async function findByAccountId({
    session,
    tenantId,
    accountId,
    limit = 100
}) {

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const normalizedAccountId =
        requireAccountId(
            accountId
        );

    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 100,
                1
            ),
            500
        );

    const query =
        LedgerEntry
            .find({

                tenantId:
                    normalizedTenantId,

                accountId:
                    normalizedAccountId

            })
            .sort({
                createdAt:
                    -1
            })
            .limit(
                safeLimit
            );

    if (session) {

        query.session(
            session
        );
    }

    return query
        .lean()
        .exec();
}

// =============================================================================
// Count Entries by Financial Transaction
// =============================================================================

async function countByTransactionId({
    session,
    transactionId,
    tenantId
}) {

    const normalizedTransactionId =
        requireTransactionId(
            transactionId
        );

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const query =
        LedgerEntry.countDocuments({

            transactionId:
                normalizedTransactionId,

            tenantId:
                normalizedTenantId

        });

    if (session) {

        query.session(
            session
        );
    }

    return query.exec();
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {

    LEDGER_DIRECTIONS,

    createEntry,

    createEntries,

    findByTransactionId,

    findByAccountId,

    countByTransactionId

};