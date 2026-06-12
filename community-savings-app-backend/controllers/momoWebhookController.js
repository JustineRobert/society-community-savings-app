// controllers/momoWebhookController.js

const Transaction = require("../models/Transaction");
const ledgerService = require("../services/ledgerService");

/**
 * MoMo Webhook Callback Handler
 * - Validates payload
 * - Ensures idempotency (no double processing)
 * - Updates transaction safely
 * - Triggers double-entry ledger
 */
exports.momoCallback = async (req, res) => {
  try {
    const payload = req.body;

    // ✅ 1. Basic Validation
    if (!payload || !payload.externalId) {
      console.error("❌ Invalid MoMo payload:", payload);
      return res.status(400).json({ message: "Invalid payload" });
    }

    // ✅ 2. Fetch existing transaction
    const existingTransaction = await Transaction.findOne({
      externalId: payload.externalId
    });

    if (!existingTransaction) {
      console.error("❌ Transaction not found:", payload.externalId);
      return res.status(404).json({ message: "Transaction not found" });
    }

    // ✅ 3. Idempotency Check (prevent double ledger posting)
    if (existingTransaction.status === "SUCCESSFUL") {
      console.warn("⚠️ Duplicate callback ignored:", payload.externalId);
      return res.sendStatus(200);
    }

    // ✅ 4. Update transaction
    const transaction = await Transaction.findOneAndUpdate(
      { externalId: payload.externalId },
      {
        status: payload.status,
        momoTransactionId: payload.financialTransactionId,
        rawCallback: payload // store full payload for audit
      },
      { new: true }
    );

    // ✅ 5. Process ledger ONLY on success
    if (payload.status === "SUCCESSFUL") {
      console.log("✅ Processing ledger for:", transaction.externalId);

      // ✅ Extra safety: prevent negative/zero amounts
      if (!transaction.amount || transaction.amount <= 0) {
        throw new Error("Invalid transaction amount");
      }

      // ✅ Ledger routing
      const ledgerPayload = {
        transactionId: transaction.externalId,
        amount: transaction.amount
      };

      if (transaction.type === "DEPOSIT") {
        await ledgerService.processTransaction({
          ...ledgerPayload,
          fromWalletId: process.env.SYSTEM_WALLET_ID, // SACCO treasury
          toWalletId: transaction.userId,
          description: "MoMo Deposit"
        });
      }

      if (transaction.type === "WITHDRAW") {
        await ledgerService.processTransaction({
          ...ledgerPayload,
          fromWalletId: transaction.userId,
          toWalletId: process.env.SYSTEM_WALLET_ID,
          description: "MoMo Withdrawal"
        });
      }

      if (!["DEPOSIT", "WITHDRAW"].includes(transaction.type)) {
        console.warn("⚠️ Unknown transaction type:", transaction.type);
      }
    }

    // ✅ 6. Handle failure case (optional but recommended)
    if (payload.status === "FAILED") {
      console.warn("❌ MoMo transaction failed:", payload.externalId);
      // Optional: trigger retry, alerting, or user notification
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ MoMo webhook error:", err.message);

    // ✅ Always return 200 to prevent MoMo retries storm
    res.sendStatus(200);
  }
};