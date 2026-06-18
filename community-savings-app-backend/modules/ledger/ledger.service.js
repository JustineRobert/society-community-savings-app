// services/ledgerService.js
"use strict";

const mongoose = require("mongoose");
const Ledger = require("../models/Ledger");

/**
 * Post a balanced double-entry ledger record
 * - Creates both debit and credit entries atomically
 * - Validates tenant context and positive amount
 * - Uses MongoDB session for transaction safety
 *
 * @param {Object} params
 * @param {String} params.tenantId - Tenant identifier
 * @param {String} params.transactionId - Transaction reference
 * @param {String} params.debitAccount - Debit account code
 * @param {String} params.creditAccount - Credit account code
 * @param {Number|String} params.amount - Transaction amount
 * @param {String} [params.currency="UGX"] - ISO currency code
 * @returns {Promise<Array>} - Array of created ledger entries
 */
async function postDoubleEntry({
  tenantId,
  transactionId,
  debitAccount,
  creditAccount,
  amount,
  currency = "UGX",
}) {
  if (!tenantId) throw new Error("TenantId is required");
  if (!transactionId) throw new Error("TransactionId is required");
  if (!debitAccount || !creditAccount) throw new Error("Both accounts required");
  if (!amount || Number(amount) <= 0) throw new Error("Amount must be positive");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const entries = await Ledger.insertMany(
      [
        {
          tenantId,
          transactionId,
          debitAccount,
          creditAccount,
          amount,
          currency,
          status: "posted",
        },
        {
          tenantId,
          transactionId,
          debitAccount: creditAccount,
          creditAccount: debitAccount,
          amount,
          currency,
          status: "posted",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return entries;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  postDoubleEntry,
};
