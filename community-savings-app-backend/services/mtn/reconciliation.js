// backend/services/mtn/reconciliation.js
/**
 * ============================================================================
 * MTN MOMO RECONCILIATION SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Daily Settlement Matching
 *  - Ledger Matching
 *  - Variance Detection
 *  - Missing Transaction Detection
 *  - Duplicate Detection
 *  - Settlement Verification
 *  - Reconciliation Reporting
 *  - Audit Logging
 *
 * ============================================================================
 */

const crypto = require("crypto");

let logger;
let Transaction;
let LedgerEntry;
let AuditLog;

try {
  logger = require("../../modules/logger");
} catch {
  logger = console;
}

try {
  Transaction = require("../../models/Transaction");
} catch {
  Transaction = null;
}

try {
  LedgerEntry = require("../../models/LedgerEntry");
} catch {
  LedgerEntry = null;
}

try {
  AuditLog = require("../../models/AuditLog");
} catch {
  AuditLog = null;
}

class MTNReconciliationService {
  constructor() {
    this.provider = "MTN_MOMO";

    this.toleranceAmount =
      Number(
        process.env.RECON_TOLERANCE_AMOUNT
      ) || 1;

    this.currency =
      process.env.DEFAULT_CURRENCY || "UGX";
  }

  /**
   * ==========================================================================
   * AUDIT
   * ==========================================================================
   */

  async recordAudit(action, payload = {}) {
    try {
      const auditEntry = {
        provider: this.provider,
        action,
        payload,
        timestamp: new Date(),
      };

      if (AuditLog?.create) {
        await AuditLog.create(auditEntry);
      }

      logger.info(
        `[MTN RECON] ${action}`,
        payload
      );
    } catch (error) {
      logger.error(
        "[MTN RECON] Audit Error",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * DATE RANGE
   * ==========================================================================
   */

  buildDayRange(date) {
    const targetDate = new Date(date);

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * ==========================================================================
   * LOAD INTERNAL TRANSACTIONS
   * ==========================================================================
   */

  async loadTransactions(date) {
    if (!Transaction) {
      return [];
    }

    const { start, end } =
      this.buildDayRange(date);

    return Transaction.find({
      provider: this.provider,
      createdAt: {
        $gte: start,
        $lte: end,
      },
    }).lean();
  }

  /**
   * ==========================================================================
   * LOAD LEDGER ENTRIES
   * ==========================================================================
   */

  async loadLedgerEntries(date) {
    if (!LedgerEntry) {
      return [];
    }

    const { start, end } =
      this.buildDayRange(date);

    return LedgerEntry.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    }).lean();
  }

  /**
   * ==========================================================================
   * LOAD MTN SETTLEMENT FILE
   * ==========================================================================
   *
   * Replace with:
   *  - MTN Settlement API
   *  - CSV Import
   *  - SFTP Import
   *
   * ==========================================================================
   */

  async loadProviderTransactions(
    providerTransactions = []
  ) {
    return providerTransactions;
  }

  /**
   * ==========================================================================
   * MATCH BY REFERENCE
   * ==========================================================================
   */

  buildReferenceMap(items) {
    const map = new Map();

    for (const item of items) {
      const reference =
        item.reference ||
        item.providerReference ||
        item.externalId;

      if (reference) {
        map.set(reference, item);
      }
    }

    return map;
  }

  /**
   * ==========================================================================
   * VARIANCE DETECTION
   * ==========================================================================
   */

  detectVariance(
    internalAmount,
    providerAmount
  ) {
    return (
      Math.abs(
        Number(internalAmount) -
          Number(providerAmount)
      ) > this.toleranceAmount
    );
  }

  /**
   * ==========================================================================
   * DUPLICATE DETECTION
   * ==========================================================================
   */

  detectDuplicates(records) {
    const seen = new Set();
    const duplicates = [];

    for (const record of records) {
      const reference =
        record.reference ||
        record.providerReference;

      if (!reference) continue;

      if (seen.has(reference)) {
        duplicates.push(record);
      } else {
        seen.add(reference);
      }
    }

    return duplicates;
  }

  /**
   * ==========================================================================
   * MATCH INTERNAL VS PROVIDER
   * ==========================================================================
   */

  reconcileTransactions(
    internalTransactions,
    providerTransactions
  ) {
    const matched = [];
    const missingInternal = [];
    const missingProvider = [];
    const variances = [];

    const internalMap =
      this.buildReferenceMap(
        internalTransactions
      );

    const providerMap =
      this.buildReferenceMap(
        providerTransactions
      );

    for (const [
      reference,
      internalTx,
    ] of internalMap.entries()) {
      const providerTx =
        providerMap.get(reference);

      if (!providerTx) {
        missingProvider.push(
          internalTx
        );
        continue;
      }

      const amountMismatch =
        this.detectVariance(
          internalTx.amount,
          providerTx.amount
        );

      if (amountMismatch) {
        variances.push({
          reference,
          internalAmount:
            internalTx.amount,
          providerAmount:
            providerTx.amount,
          difference:
            Number(
              providerTx.amount
            ) -
            Number(
              internalTx.amount
            ),
        });
      }

      matched.push({
        reference,
        internal: internalTx,
        provider: providerTx,
      });
    }

    for (const [
      reference,
      providerTx,
    ] of providerMap.entries()) {
      if (
        !internalMap.has(reference)
      ) {
        missingInternal.push(
          providerTx
        );
      }
    }

    return {
      matched,
      missingInternal,
      missingProvider,
      variances,
    };
  }

  /**
   * ==========================================================================
   * LEDGER MATCHING
   * ==========================================================================
   */

  reconcileLedger(
    transactions,
    ledgerEntries
  ) {
    const transactionTotal =
      transactions.reduce(
        (sum, tx) =>
          sum +
          Number(tx.amount || 0),
        0
      );

    const ledgerTotal =
      ledgerEntries.reduce(
        (sum, entry) =>
          sum +
          Number(entry.amount || 0),
        0
      );

    const difference =
      ledgerTotal -
      transactionTotal;

    return {
      transactionTotal,
      ledgerTotal,
      difference,
      balanced:
        Math.abs(difference) <=
        this.toleranceAmount,
    };
  }

  /**
   * ==========================================================================
   * DAILY RECONCILIATION
   * ==========================================================================
   */

  async reconcileDaily({
    date = new Date(),
    providerTransactions = [],
  } = {}) {
    const runId =
      crypto.randomUUID();

    await this.recordAudit(
      "RECON_STARTED",
      {
        runId,
        date,
      }
    );

    const internalTransactions =
      await this.loadTransactions(
        date
      );

    const ledgerEntries =
      await this.loadLedgerEntries(
        date
      );

    const providerData =
      await this.loadProviderTransactions(
        providerTransactions
      );

    const transactionResults =
      this.reconcileTransactions(
        internalTransactions,
        providerData
      );

    const ledgerResults =
      this.reconcileLedger(
        internalTransactions,
        ledgerEntries
      );

    const duplicateInternal =
      this.detectDuplicates(
        internalTransactions
      );

    const duplicateProvider =
      this.detectDuplicates(
        providerData
      );

    const report = {
      runId,
      provider: this.provider,
      date,

      summary: {
        internalTransactions:
          internalTransactions.length,

        providerTransactions:
          providerData.length,

        matched:
          transactionResults
            .matched.length,

        missingInternal:
          transactionResults
            .missingInternal.length,

        missingProvider:
          transactionResults
            .missingProvider.length,

        variances:
          transactionResults
            .variances.length,

        duplicateInternal:
          duplicateInternal.length,

        duplicateProvider:
          duplicateProvider.length,
      },

      ledger: ledgerResults,

      exceptions: {
        missingInternal:
          transactionResults.missingInternal,

        missingProvider:
          transactionResults.missingProvider,

        variances:
          transactionResults.variances,

        duplicateInternal,

        duplicateProvider,
      },

      generatedAt:
        new Date().toISOString(),
    };

    await this.recordAudit(
      "RECON_COMPLETED",
      {
        runId,
        summary:
          report.summary,
      }
    );

    return report;
  }

  /**
   * ==========================================================================
   * SETTLEMENT VALIDATION
   * ==========================================================================
   */

  async validateSettlement({
    expectedAmount,
    settledAmount,
  }) {
    const difference =
      Number(settledAmount) -
      Number(expectedAmount);

    return {
      valid:
        Math.abs(difference) <=
        this.toleranceAmount,

      expectedAmount,
      settledAmount,
      difference,
      checkedAt:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * RECON HEALTH
   * ==========================================================================
   */

  healthCheck() {
    return {
      service:
        "MTN_RECONCILIATION",
      provider: this.provider,
      toleranceAmount:
        this.toleranceAmount,
      currency: this.currency,
      timestamp:
        new Date().toISOString(),
    };
  }
}

module.exports =
  new MTNReconciliationService();