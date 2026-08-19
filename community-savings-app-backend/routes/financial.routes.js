"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * Financial Routes
 * =============================================================================
 *
 * File:
 *   backend/routes/financial.routes.js
 *
 * Purpose:
 *   Define the HTTP boundary for balance-affecting financial operations.
 *
 * Security / correctness chain:
 *
 *   HTTP Request
 *        │
 *        ▼
 *   Authentication
 *        │
 *        ▼
 *   Tenant Authorization
 *        │
 *        ▼
 *   Idempotency
 *        │
 *        ▼
 *   Financial Controller
 *        │
 *        ▼
 *   Financial Transaction Service
 *        │
 *        ├── Financial Transaction
 *        ├── Ledger Entries
 *        ├── Balance Mutation
 *        └── Idempotency Completion
 *        │
 *        ▼
 *      COMMIT
 *
 * =============================================================================
 *
 * IMPORTANT
 * =============================================================================
 *
 * This router deliberately does NOT:
 *
 *   - mutate balances
 *   - write ledger entries
 *   - create financial transactions
 *   - perform MongoDB transactions
 *   - implement idempotency persistence
 *
 * Those responsibilities belong to the service/repository layers.
 *
 * =============================================================================
 */

const express =
    require("express");

const {
    idempotency
} = require(
    "../middleware/idempotency"
);

// =============================================================================
// Middleware
// =============================================================================
//
// These imports intentionally use capability-based fallbacks so this route
// module remains compatible while the authentication/authorization layer is
// being consolidated.
//
// Replace the fallback resolution with your canonical middleware once the
// project's security middleware names are finalized.
// =============================================================================

const authenticate =
    resolveMiddleware(
        [
            "../middleware/authentication",
            "../middleware/auth",
            "../middleware/authenticate"
        ],
        "authenticate"
    );

const tenantAuthorization =
    resolveMiddleware(
        [
            "../middleware/tenantAuthorization",
            "../middleware/tenant.authorization",
            "../middleware/tenant"
        ],
        "tenantAuthorization"
    );

// =============================================================================
// Controller
// =============================================================================

const financialController =
    require(
        "../controllers/financial/financial.controller"
    );

// =============================================================================
// Router
// =============================================================================

const router =
    express.Router();

// =============================================================================
// Router Configuration
// =============================================================================

router.use(
    express.json({
        limit:
            "1mb"
    })
);

// =============================================================================
// Financial Transaction
// =============================================================================
//
// Generic balance-affecting transaction endpoint.
//
// Security chain:
//
//   authenticate
//       ↓
//   tenantAuthorization
//       ↓
//   idempotency
//       ↓
//   controller
//
// The idempotency middleware MUST execute after authentication and tenant
// authorization because the idempotency identity is scoped to:
//
//   tenant + principal + idempotency key
//
// =============================================================================

router.post(

    "/transactions",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "FINANCIAL_TRANSACTION",

        resource:
            "financial-transactions",

        required:
            true

    }),

    financialController.createTransaction
);

// =============================================================================
// Contributions
// =============================================================================
//
// Example future financial product.
//
// This endpoint is deliberately explicit rather than routing all financial
// operations through one generic endpoint.
//
// =============================================================================

router.post(

    "/contributions",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "CONTRIBUTION_CREATE",

        resource:
            "contributions",

        required:
            true

    }),

    financialController.createContribution
);

// =============================================================================
// Deposits
// =============================================================================

router.post(

    "/deposits",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "DEPOSIT_CREATE",

        resource:
            "deposits",

        required:
            true

    }),

    financialController.createDeposit
);

// =============================================================================
// Withdrawals
// =============================================================================

router.post(

    "/withdrawals",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "WITHDRAWAL_CREATE",

        resource:
            "withdrawals",

        required:
            true

    }),

    financialController.createWithdrawal
);

// =============================================================================
// Transfers
// =============================================================================

router.post(

    "/transfers",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "TRANSFER_CREATE",

        resource:
            "transfers",

        required:
            true

    }),

    financialController.createTransfer
);

// =============================================================================
// Loan Disbursement
// =============================================================================
//
// Loan disbursement is balance-affecting and therefore requires the same
// exactly-once financial boundary.
//
// =============================================================================

router.post(

    "/loans/:loanId/disbursement",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "LOAN_DISBURSEMENT",

        resource:
            "loan-disbursement",

        required:
            true

    }),

    financialController.disburseLoan
);

// =============================================================================
// Loan Repayment
// =============================================================================

router.post(

    "/loans/:loanId/repayment",

    authenticate,

    tenantAuthorization,

    idempotency({

        operation:
            "LOAN_REPAYMENT",

        resource:
            "loan-repayment",

        required:
            true

    }),

    financialController.repayLoan
);

// =============================================================================
// Mobile Money Collection
// =============================================================================
//
// Provider callbacks/webhooks should NOT normally use the authenticated-user
// idempotency chain above. They require provider signature verification and a
// separate webhook idempotency boundary.
//
// Therefore provider callbacks should live under a separate route module.
//
// Example:
//
//   backend/routes/webhooks/mobileMoney.routes.js
//
// =============================================================================

// =============================================================================
// Wallet Balance Read
// =============================================================================
//
// Reads do not require financial idempotency.
//
// Authentication and tenant authorization still apply.
//
// =============================================================================

router.get(

    "/wallet/:walletId",

    authenticate,

    tenantAuthorization,

    financialController.getWallet
);

// =============================================================================
// Transaction Lookup
// =============================================================================

router.get(

    "/transactions/:transactionId",

    authenticate,

    tenantAuthorization,

    financialController.getTransaction
);

// =============================================================================
// Ledger Lookup
// =============================================================================
//
// Read-only endpoint. No idempotency middleware is necessary.
//
// =============================================================================

router.get(

    "/transactions/:transactionId/ledger",

    authenticate,

    tenantAuthorization,

    financialController.getTransactionLedger
);

// =============================================================================
// Health / Router Metadata
// =============================================================================
//
// This is intentionally lightweight and does not expose financial data.
//
// =============================================================================

router.get(
    "/_meta",
    (req, res) => {

        res.status(200).json({

            success:
                true,

            service:
                "ACFOS Financial API",

            version:
                "1",

            idempotency:
                "required-for-financial-mutations",

            transactionBoundary:
                "MongoDB-session",

            timestamp:
                new Date().toISOString()

        });
    }
);

// =============================================================================
// Middleware Resolver
// =============================================================================

/**
 * Resolve a middleware module from a list of candidate paths.
 *
 * Supported module shapes:
 *
 *   module.exports = function authenticate() {}
 *
 *   module.exports = {
 *       authenticate
 *   }
 *
 *   module.exports = {
 *       tenantAuthorization
 *   }
 *
 * This allows the financial router to be introduced without forcing an
 * unrelated refactor of the existing authentication implementation.
 */
function resolveMiddleware(
    candidates,
    exportName
) {

    for (
        const candidate
        of candidates
    ) {

        try {

            const moduleValue =
                require(candidate);

            if (
                typeof moduleValue ===
                "function"
            ) {

                return moduleValue;
            }

            if (
                moduleValue &&
                typeof moduleValue[
                    exportName
                ] === "function"
            ) {

                return moduleValue[
                    exportName
                ];
            }

        } catch (error) {

            /*
             * Continue searching candidate modules.
             *
             * Only ignore module-not-found errors for candidate resolution.
             * Other errors must surface immediately because they indicate a
             * broken middleware module.
             */

            if (
                error &&
                error.code !==
                    "MODULE_NOT_FOUND"
            ) {

                throw error;
            }
        }
    }

    /*
     * Fail closed.
     *
     * A financial route must NEVER silently operate without authentication or
     * tenant authorization.
     */
    return function missingRequiredMiddleware(
        req,
        res,
        next
    ) {

        const error =
            new Error(
                `Required security middleware "${exportName}" is not configured.`
            );

        error.code =
            "FINANCIAL_SECURITY_MIDDLEWARE_NOT_CONFIGURED";

        error.statusCode =
            500;

        next(error);
    };
}

// =============================================================================
// Export
// =============================================================================

module.exports = router;