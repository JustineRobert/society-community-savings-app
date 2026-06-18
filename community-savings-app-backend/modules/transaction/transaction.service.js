// services/transactionService.js
"use strict";

const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { postDoubleEntry } = require("../ledger/ledger.service");

/**
 * Create a transaction with double-entry ledger posting
 * - Enforces idempotency via idempotencyKey
 * - Validates tenant context and positive amount
 * - Uses MongoDB session for atomicity
 *
 * @param {Object} params
 * @param {String} params.tenantId - Tenant identifier
 * @param {String} params.type - Transaction type (deposit, withdrawal, etc.)
 * @param {Number|String} params.amount - Transaction amount
 * @param {String} params.idempotencyKey - Unique key to prevent duplicates
 * @returns {Promise<Document>} - Transaction document
 */
async function createTransaction({ tenantId, type, amount, idempotencyKey }) {
  if (!tenantId) throw new Error("TenantId is required");
  if (!type) throw new Error("Transaction type is required");
  if (!amount || Number(amount) <= 0) throw new Error("Amount must be positive");
  if (!idempotencyKey) throw new Error("IdempotencyKey is required");

  // ✅ Idempotency check
  const existing = await Transaction.findOne({ tenantId, idempotencyKey }).lean();
  if (existing) {
    return existing;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ Create transaction
    const transaction = await Transaction.create(
      [
        {
          tenantId,
          type,
          amount,
          idempotencyKey,
          status: "pending",
        },
      ],
      { session }
    );

    const txnDoc = transaction[0];

    // ✅ Post ledger entries atomically
    await postDoubleEntry({
      tenantId,
      transactionId: txnDoc._id,
      debitAccount: "cash_account",
      creditAccount: "user_wallet",
      amount,
      currency: "UGX",
    });

    // ✅ Mark transaction complete
    txnDoc.status = "completed";
    await txnDoc.save({ session });

    await session.commitTransaction();
    return txnDoc;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createTransaction,
};
