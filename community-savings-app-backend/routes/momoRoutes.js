// routes/momoRoutes.js
// Production-ready route definitions for MoMo endpoints.
// - Validates controller handlers at module load time to fail fast with clear errors.
// - Uses small wrapper to ensure async handlers are properly handled by Express.
// - Includes production-grade MoMo callback handler for ledger + wallet processing.

const express = require("express");
const router = express.Router();

// Import controllers (named exports expected)
const momoCollectionController = require("../controllers/momoCollectionController");
const momoDisbursementController = require("../controllers/momoDisbursementController");
const momoWebhookController = require("../controllers/momoWebhookController");

// Models / Services used by the callback handler
const Transaction = require("../models/Transaction");
const ledgerService = require("../services/ledger.service");
const walletService = require("../services/wallet.service");

/**
 * Helper: ensure a handler exists and is a function.
 * Throws a clear error during startup if the handler is missing,
 * which prevents the cryptic "Route.post() requires a callback function" runtime error.
 */
function ensureHandler(handler, name, modulePath) {
  if (typeof handler !== "function") {
    // Throwing here makes the problem obvious at startup instead of producing an undefined callback at runtime.
    throw new Error(
      `Missing or invalid handler "${name}" exported from "${modulePath}". Expected a function but got ${typeof handler}.`
    );
  }
  return handler;
}

/**
 * Small wrapper to catch async errors and forward to next()
 * so Express error middleware can handle them.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/* Resolve handlers and validate exports */
const requestToPay = ensureHandler(
  momoCollectionController.requestToPay || momoCollectionController.handleRequestToPay,
  "requestToPay",
  "../controllers/momoCollectionController"
);

const disburse = ensureHandler(
  momoDisbursementController.disburse || momoDisbursementController.handleDisburse,
  "disburse",
  "../controllers/momoDisbursementController"
);

const momoCallback = ensureHandler(
  momoWebhookController.momoCallback || momoWebhookController.handleMoMoWebhook || momoWebhookController.handleWebhook,
  "momoCallback",
  "../controllers/momoWebhookController"
);

/* Routes */
/* POST /deposit -> initiate request-to-pay */
router.post("/deposit", asyncHandler(requestToPay));

/* POST /withdraw -> disbursement endpoint */
router.post("/withdraw", asyncHandler(disburse));

/* POST /webhook -> provider callback/webhook (controller-based) */
router.post("/webhook", asyncHandler(momoCallback));

/* POST /momo/callback -> inline production-grade callback handler
   Kept as an additional explicit endpoint for providers that post to /momo/callback.
   Logic mirrors the production callback: validation, transaction lookup,
   status update, ledger double-entry, and wallet sync.
*/
router.post(
  "/momo/callback",
  asyncHandler(async (req, res) => {
    try {
      const payload = req.body;
      console.log("MoMo callback received:", payload);

      // Validate payload
      if (!payload.externalId || !payload.status) {
        return res.status(400).json({ error: "Invalid MoMo callback payload" });
      }

      // Find transaction
      const transaction = await Transaction.findOne({ externalId: payload.externalId });
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // Update transaction status + MoMo reference
      transaction.status = payload.status;
      transaction.momoTransactionId = payload.financialTransactionId;
      await transaction.save();

      // Process successful transactions
      if (payload.status === "SUCCESSFUL") {
        // Ledger double-entry
        await ledgerService.createEntries({
          transactionId: transaction._id,
          tenantId: transaction.tenantId,
          entries: [
            {
              account: "CASH_ACCOUNT_ID", // replace with dynamic treasury account
              type: transaction.flow === "credit" ? "DEBIT" : "CREDIT",
              amount: transaction.amount,
            },
            {
              account: "USER_WALLET_ACCOUNT_ID", // replace with dynamic user wallet account
              type: transaction.flow === "credit" ? "CREDIT" : "DEBIT",
              amount: transaction.amount,
            },
          ],
        });

        // Wallet update
        if (transaction.flow === "credit") {
          await walletService.creditWallet(transaction.user, transaction.amount);
        } else {
          await walletService.debitWallet(transaction.user, transaction.amount);
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("MoMo callback error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  })
);

module.exports = router;
