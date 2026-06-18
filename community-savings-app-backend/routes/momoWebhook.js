// routes/momoWebhook.js
const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const ledgerService = require("../services/ledgerService");
const walletService = require("../services/walletService");
const logger = require("../utils/logger");

router.post("/momo/callback", async (req, res) => {
  const requestId = req.headers["x-request-id"] || req.requestId || "no-request-id";
  const log = logger.withRequest(requestId);

  try {
    const payload = req.body;
    log.info("MoMo callback received", { payload });

    // Validate payload
    if (!payload.externalId || !payload.status) {
      log.warn("Invalid MoMo callback payload", { payload });
      return res.status(400).json({ error: "Invalid MoMo callback payload" });
    }

    // Find transaction
    const transaction = await Transaction.findOne({ externalId: payload.externalId });
    if (!transaction) {
      log.error("Transaction not found", { externalId: payload.externalId });
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Update transaction status + MoMo reference
    transaction.status = payload.status;
    transaction.momoTransactionId = payload.financialTransactionId;
    await transaction.save();
    log.info("Transaction updated", { transactionId: transaction._id, status: transaction.status });

    // Process successful transactions
    if (payload.status === "SUCCESSFUL") {
      // Ledger double-entry
      await ledgerService.recordEntry({
        tenantId: transaction.tenantId,
        debit: "CASH_ACCOUNT_ID",
        credit: transaction.user.toString(),
        amount: transaction.amount,
        ref: `momo:${transaction._id}`,
        requestId,
      });
      log.info("Ledger entries created", { transactionId: transaction._id });

      // Wallet update
      if (transaction.flow === "credit") {
        await walletService.creditWallet({ userId: transaction.user, tenantId: transaction.tenantId, amount: transaction.amount, requestId });
        log.info("Wallet credited", { userId: transaction.user, amount: transaction.amount });
      } else {
        await walletService.debitWallet({ userId: transaction.user, tenantId: transaction.tenantId, amount: transaction.amount, requestId });
        log.info("Wallet debited", { userId: transaction.user, amount: transaction.amount });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    log.error("MoMo callback error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
