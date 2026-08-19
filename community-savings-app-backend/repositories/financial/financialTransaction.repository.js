"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/repositories/financial/financialTransaction.repository.js
 *
 * Purpose:
 *   Persistence boundary for immutable financial transaction records.
 *
 * Architectural Position:
 *
 *   Financial Service
 *          ↓
 *   Financial Repository
 *          ↓
 *   FinancialTransaction Model
 *          ↓
 *   MongoDB Session
 *
 * Repository Rules:
 *
 *   ✓ Every financial write requires a MongoDB session.
 *   ✓ Repository NEVER starts a transaction.
 *   ✓ Repository NEVER commits a transaction.
 *   ✓ Repository NEVER aborts a transaction.
 *   ✓ Transaction ID must be unique.
 *   ✓ Tenant ownership is always persisted.
 *   ✓ Tenant ownership is always included in scoped reads.
 *   ✓ Financial transaction records are immutable.
 *   ✓ No generic update/delete operations are exposed.
 *   ✓ Duplicate transaction IDs are converted to domain errors.
 *
 * IMPORTANT:
 *
 *   This repository does not decide whether a financial transaction is
 *   authorized or financially valid.
 *
 *   Authorization belongs to the authorization layer.
 *   Business validation belongs to the financial service.
 *   Atomicity belongs to the financial transaction coordinator.
 * =============================================================================
 */

const {
    FinancialTransaction
} = require(
    "../../models/financialTransaction.model"
);

const {
    FinancialTransactionError
} = require(
    "../../services/financial/financialTransaction.service"
);

// =============================================================================
// Constants
// =============================================================================

const TRANSACTION_STATUSES =
    Object.freeze([
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REVERSED",
        "CANCELLED"
    ]);

const MAX_TRANSACTION_ID_LENGTH = 128;
const MAX_TENANT_ID_LENGTH = 128;
const MAX_PRINCIPAL_ID_LENGTH = 128;
const MAX_OPERATION_LENGTH = 128;
const MAX_RESOURCE_LENGTH = 256;
const MAX_CURRENCY_LENGTH = 16;

// =============================================================================
// Validation Helpers
// =============================================================================

function throwRepositoryError(
    message,
    code,
    statusCode = 500,
    details = undefined
) {

    /*
     * FinancialTransactionError implementations may evolve.
     *
     * The repository attempts to preserve diagnostic details when the domain
     * error supports them.
     */

    const error =
        new FinancialTransactionError(
            message,
            code,
            statusCode
        );

    if (details !== undefined) {
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

        throw throwRepositoryError(
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
    options = {}
) {

    const {

        maxLength,

        trim = true

    } = options;

    if (
        value === undefined ||
        value === null
    ) {

        throw throwRepositoryError(
            `${field} is required.`,
            "FINANCIAL_TRANSACTION_FIELD_REQUIRED",
            400,
            {
                field
            }
        );
    }

    const normalized =
        trim &&
        typeof value === "string"
            ? value.trim()
            : value;

    if (
        normalized === ""
    ) {

        throw throwRepositoryError(
            `${field} is required.`,
            "FINANCIAL_TRANSACTION_FIELD_REQUIRED",
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

        throw throwRepositoryError(
            `${field} exceeds the maximum permitted length.`,
            "FINANCIAL_TRANSACTION_FIELD_TOO_LONG",
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

        throw throwRepositoryError(
            `${field} contains invalid characters.`,
            "FINANCIAL_TRANSACTION_INVALID_IDENTIFIER",
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
// Principal ID
// =============================================================================

function requirePrincipalId(
    principalId
) {

    return requireIdentifier(
        principalId,
        "principalId",
        MAX_PRINCIPAL_ID_LENGTH
    );
}

// =============================================================================
// Operation
// =============================================================================

function requireOperation(
    operation
) {

    return requireIdentifier(
        operation,
        "operation",
        MAX_OPERATION_LENGTH
    );
}

// =============================================================================
// Resource
// =============================================================================

function requireResource(
    resource
) {

    return requireValue(
        resource,
        "resource",
        {
            maxLength:
                MAX_RESOURCE_LENGTH
        }
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

    const value =
        String(
            normalized
        ).toUpperCase();

    if (
        !/^[A-Z]{3,16}$/.test(
            value
        )
    ) {

        throw throwRepositoryError(
            "Invalid currency code.",
            "FINANCIAL_TRANSACTION_INVALID_CURRENCY",
            400,
            {
                currency:
                    value
            }
        );
    }

    return value;
}

// =============================================================================
// Amount
// =============================================================================
//
// Do not perform floating-point arithmetic here.
//
// Financial calculations should happen in the financial domain/service layer
// using Decimal128 / integer minor units according to the model design.
//
// The repository validates presence and delegates the canonical representation
// to Mongoose.
// =============================================================================

function requireAmount(
    amount
) {

    if (
        amount === undefined ||
        amount === null
    ) {

        throw throwRepositoryError(
            "amount is required.",
            "FINANCIAL_TRANSACTION_AMOUNT_REQUIRED",
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
// Status
// =============================================================================

function requireStatus(
    status
) {

    const normalized =
        String(
            status ||
            "COMPLETED"
        )
            .trim()
            .toUpperCase();

    if (
        !TRANSACTION_STATUSES.includes(
            normalized
        )
    ) {

        throw throwRepositoryError(
            "Invalid financial transaction status.",
            "FINANCIAL_TRANSACTION_INVALID_STATUS",
            400,
            {
                status:
                    normalized
            }
        );
    }

    return normalized;
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
        typeof metadata !==
        "object" ||
        Array.isArray(metadata)
    ) {

        throw throwRepositoryError(
            "Financial transaction metadata must be an object.",
            "FINANCIAL_TRANSACTION_INVALID_METADATA",
            400,
            {
                field:
                    "metadata"
            }
        );
    }

    /*
     * Clone the object so callers cannot mutate the same object reference
     * after repository invocation.
     */

    return {
        ...metadata
    };
}

// =============================================================================
// Create
// =============================================================================

async function create({
    session,
    transactionId,
    tenantId,
    principalId,
    operation,
    resource,
    amount,
    currency,
    status = "COMPLETED",
    metadata = {}
}) {

    requireSession(
        session
    );

    const normalizedTransactionId =
        requireTransactionId(
            transactionId
        );

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const normalizedPrincipalId =
        requirePrincipalId(
            principalId
        );

    const normalizedOperation =
        requireOperation(
            operation
        );

    const normalizedResource =
        requireResource(
            resource
        );

    const normalizedAmount =
        requireAmount(
            amount
        );

    const normalizedCurrency =
        requireCurrency(
            currency
        );

    const normalizedStatus =
        requireStatus(
            status
        );

    const normalizedMetadata =
        normalizeMetadata(
            metadata
        );

    try {

        const [record] =
            await FinancialTransaction.create(

                [
                    {

                        transactionId:
                            normalizedTransactionId,

                        tenantId:
                            normalizedTenantId,

                        principalId:
                            normalizedPrincipalId,

                        operation:
                            normalizedOperation,

                        resource:
                            normalizedResource,

                        amount:
                            normalizedAmount,

                        currency:
                            normalizedCurrency,

                        status:
                            normalizedStatus,

                        metadata:
                            normalizedMetadata

                    }
                ],

                {
                    session
                }

            );

        return record;

    } catch (error) {

        /*
         * MongoDB duplicate-key violation.
         *
         * This is an expected domain-level race condition when two requests
         * attempt to create the same financial transaction concurrently.
         */

        if (
            error?.code === 11000
        ) {

            throw throwRepositoryError(
                "Financial transaction already exists.",
                "FINANCIAL_TRANSACTION_ALREADY_EXISTS",
                409,
                {
                    transactionId:
                        normalizedTransactionId,

                    tenantId:
                        normalizedTenantId
                }
            );
        }

        throw error;
    }
}

// =============================================================================
// Find by Transaction ID
// =============================================================================
//
// Reads do not create or commit transactions.
//
// A session is accepted when the caller is already operating inside a MongoDB
// transaction. This allows consistent reads from the same transactional view.
//
// =============================================================================

async function findById({
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
        FinancialTransaction.findOne({

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

    return query
        .lean()
        .exec();
}

// =============================================================================
// Find by Transaction ID - Required Existing Record
// =============================================================================

async function requireById({
    session,
    transactionId,
    tenantId
}) {

    const record =
        await findById({

            session,

            transactionId,

            tenantId

        });

    if (!record) {

        throw throwRepositoryError(
            "Financial transaction was not found.",
            "FINANCIAL_TRANSACTION_NOT_FOUND",
            404,
            {
                transactionId,
                tenantId
            }
        );
    }

    return record;
}

// =============================================================================
// Find by Operation
// =============================================================================

async function findByOperation({
    session,
    tenantId,
    principalId,
    operation,
    limit = 50
}) {

    const normalizedTenantId =
        requireTenantId(
            tenantId
        );

    const normalizedPrincipalId =
        requirePrincipalId(
            principalId
        );

    const normalizedOperation =
        requireOperation(
            operation
        );

    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 50,
                1
            ),
            100
        );

    const query =
        FinancialTransaction
            .find({

                tenantId:
                    normalizedTenantId,

                principalId:
                    normalizedPrincipalId,

                operation:
                    normalizedOperation

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
// Exports
// =============================================================================

module.exports = {

    TRANSACTION_STATUSES,

    create,

    findById,

    requireById,

    findByOperation

};