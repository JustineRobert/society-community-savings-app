// Ledger Service (services/ledgerService.js)

const Ledger = require("../models/LedgerEntry");

/**
 * Record a single double-entry ledger line
 *
 * @param {Object} params
 * @param {String} params.tenantId - Tenant/SACCO isolation
 * @param {String} params.debit - Debit account identifier
 * @param {String} params.credit - Credit account identifier
 * @param {Number} params.amount - Transaction amount
 * @param {String} params.ref - External/internal reference
 */
exports.recordEntry = async ({ tenantId, debit, credit, amount, ref }) => {
  if (!tenantId) throw new Error("tenantId is required");
  if (!debit || !credit) throw new Error("Both debit and credit accounts are required");
  if (!amount || amount <= 0) throw new Error("Amount must be a positive number");

  return await Ledger.create({
    tenantId,
    debitAccount: debit,
    creditAccount: credit,
    amount,
    reference: ref,
  });
};
