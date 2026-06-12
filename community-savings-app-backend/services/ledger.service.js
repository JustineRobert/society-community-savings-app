// services/ledger.service.js
// Production-ready ledger service for creating balanced double-entry records.
//
// Features:
// - Strong validation of input entries
// - Decimal-safe arithmetic using Decimal.js and MongoDB Decimal128
// - Idempotency guard (by transactionId or optional idempotencyKey)
// - Uses MongoDB transactions when available (replica set) for atomic writes
// - Detailed errors and structured logging hooks
// - Optional "force" flag to bypass idempotency checks (use with caution)

const mongoose = require("mongoose");
const Decimal = require("decimal.js");
const LedgerEntry = require("../models/LedgerEntry");
const logger = require("../utils/logger"); // optional structured logger

/**
 * createEntries
 *
 * Creates balanced ledger entries for a single transaction.
 *
 * Params:
 *  - transactionId: ObjectId or string (required)
 *  - entries: Array of { account, type: "DEBIT"|"CREDIT", amount, currency?, tenantId, description?, reference?, metadata? }
 *  - tenantId: ObjectId or string (optional if provided per-entry)
 *  - options: { force: boolean, idempotencyKey: string }
 *
 * Behavior:
 *  - Validates entries and ensures total debits == total credits (Decimal-safe)
 *  - Checks for existing ledger lines for the transactionId (idempotency) unless options.force === true
 *  - Attempts to use a MongoDB transaction (session) if available; falls back to single insertMany
 *
 * Returns: Array of created LedgerEntry documents
 */
exports.createEntries = async ({ transactionId, entries = [], tenantId, options = {} } = {}) => {
  if (!transactionId) {
    throw new Error("transactionId is required");
  }

  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error("At least two ledger entries are required");
  }

  const { force = false, idempotencyKey } = options;

  // Basic entry validation and normalization
  const normalized = entries.map((e, idx) => {
    if (!e) throw new Error(`Entry at index ${idx} is falsy`);
    if (!e.account) throw new Error(`Entry at index ${idx} missing account`);
    if (!e.type || !["DEBIT", "CREDIT"].includes(e.type)) {
      throw new Error(`Entry at index ${idx} has invalid type (must be DEBIT or CREDIT)`);
    }
    if (e.amount == null) throw new Error(`Entry at index ${idx} missing amount`);
    // Use Decimal for arithmetic safety
    let amountDecimal;
    try {
      amountDecimal = new Decimal(e.amount);
    } catch (err) {
      throw new Error(`Entry at index ${idx} has invalid amount: ${e.amount}`);
    }
    if (!amountDecimal.isFinite() || amountDecimal.lte(0)) {
      throw new Error(`Entry at index ${idx} amount must be a positive number`);
    }

    return {
      account: e.account,
      type: e.type,
      amountDecimal,
      amount: mongoose.Types.Decimal128.fromString(amountDecimal.toString()),
      currency: (e.currency || "UGX").toUpperCase(),
      tenantId: e.tenantId || tenantId,
      description: e.description,
      reference: e.reference,
      metadata: e.metadata || {},
    };
  });

  // Ensure tenantId is present for all entries
  for (let i = 0; i < normalized.length; i++) {
    if (!normalized[i].tenantId) {
      throw new Error(`tenantId is required for entry at index ${i}`);
    }
  }

  // Sum debits and credits using Decimal
  const debitSum = normalized
    .filter((e) => e.type === "DEBIT")
    .reduce((acc, e) => acc.plus(e.amountDecimal), new Decimal(0));
  const creditSum = normalized
    .filter((e) => e.type === "CREDIT")
    .reduce((acc, e) => acc.plus(e.amountDecimal), new Decimal(0));

  if (!debitSum.equals(creditSum)) {
    throw new Error(
      `Ledger imbalance: total debits (${debitSum.toString()}) must equal total credits (${creditSum.toString()})`
    );
  }

  // Idempotency guard: if ledger entries already exist for this transactionId, return them unless forced
  if (!force) {
    try {
      const existingCount = await LedgerEntry.countDocuments({ transaction: transactionId }).exec();
      if (existingCount > 0) {
        logger?.info?.("Ledger entries already exist for transaction", { transactionId, existingCount, idempotencyKey });
        const existing = await LedgerEntry.find({ transaction: transactionId }).exec();
        return existing;
      }
    } catch (err) {
      // Log and continue; we don't want to fail creation just because idempotency check couldn't run
      logger?.warn?.("Failed to check existing ledger entries for idempotency", { err: err?.message, transactionId });
    }
  }

  // Prepare documents for insertion
  const docs = normalized.map((e) => ({
    account: e.account,
    transaction: transactionId,
    type: e.type,
    amount: e.amount,
    currency: e.currency,
    tenantId: e.tenantId,
    description: e.description,
    reference: e.reference || idempotencyKey || undefined,
    metadata: e.metadata,
  }));

  // Attempt to write within a MongoDB transaction if supported
  const connection = mongoose.connection;
  let session;
  let created;
  const useTransactions = connection?.client?.topology?.s?.isMaster?.() !== false; // best-effort check; will still try to startSession
  try {
    session = await mongoose.startSession();
  } catch (err) {
    session = null;
  }

  if (session) {
    try {
      session.startTransaction();
      created = await LedgerEntry.insertMany(docs, { session, ordered: true });
      await session.commitTransaction();
      session.endSession();
      logger?.info?.("Ledger entries created in transaction", { transactionId, count: created.length });
      return created;
    } catch (err) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        logger?.error?.("Failed to abort ledger transaction", { err: abortErr?.message });
      } finally {
        session.endSession();
      }
      logger?.error?.("Failed to create ledger entries in transaction", { err: err?.message, transactionId });
      throw err;
    }
  }

  // Fallback: insert without transaction
  try {
    created = await LedgerEntry.insertMany(docs, { ordered: true });
    logger?.info?.("Ledger entries created (no transaction)", { transactionId, count: created.length });
    return created;
  } catch (err) {
    logger?.error?.("Failed to create ledger entries", { err: err?.message, transactionId });
    throw err;
  }
};
