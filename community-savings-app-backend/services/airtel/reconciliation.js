// backend/services/airtel/reconciliation.js
/**
 * ============================================================================
 * AIRTEL MONEY RECONCILIATION SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Daily Settlement Matching
 *  - Airtel Transaction Matching
 *  - Internal Ledger Matching
 *  - Variance Detection
 *  - Missing Transaction Detection
 *  - Duplicate Detection
 *  - Settlement Validation
 *  - Audit Logging
 *  - Regulatory Reporting
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

class AirtelReconciliationService {
  constructor() {
    this.provider = "AIRTEL_MONEY";

    this.currency =
      process.env.DEFAULT_CURRENCY ||
      "UGX";

    this.reconciliationTolerance =
      Number(
        process.env.RECONCILIATION_TOLERANCE || 1
      );

    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      variancesDetected: 0,
    };
  }

  /**
   * ==========================================================================
   * AUDIT LOGGING
   * ==========================================================================
   */

  async recordAudit(action, payload = {}) {
    try {
      const auditRecord = {
        provider: this.provider,
        action,
        payload,
        timestamp: new Date(),
      };

      if (AuditLog?.create) {
        await AuditLog.create(auditRecord);
      }

      logger.info(
        `[AIRTEL RECONCILIATION] ${action}`,
        payload
      );
    } catch (error) {
      logger.error(
        "[AIRTEL RECONCILIATION] Audit Error",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * DATE RANGE
   * ==========================================================================
   */

  buildDateRange(date) {
    const targetDate = new Date(date);

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * ==========================================================================
   * INTERNAL TRANSACTIONS
   * ==========================================================================
   */

  async getInternalTransactions(date) {
    if (!Transaction?.find) {
      return [];
    }

    const { start, end } =
      this.buildDateRange(date);

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
   * LEDGER ENTRIES
   * ==========================================================================
   */

  async getLedgerEntries(date) {
    if (!LedgerEntry?.find) {
      return [];
    }

    const { start, end } =
      this.buildDateRange(date);

    return LedgerEntry.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    }).lean();
  }

  /**
   * ==========================================================================
   * PROVIDER TRANSACTIONS
   * ==========================================================================
   *
   * Replace later with:
   *  - Airtel Settlement API
   *  - CSV Import
   *  - SFTP Settlement Files
   *  - Direct Airtel Reconciliation Feed
   *
   * ==========================================================================
   */

  async getProviderTransactions(
    providerTransactions = []
  ) {
    return providerTransactions;
  }

  /**
   * ==========================================================================
   * REFERENCE MAP
   * ==========================================================================
   */

  buildReferenceMap(records) {
    const map = new Map();

    for (const record of records) {
      const reference =
        record.reference ||
        record.externalReference ||
        record.providerReference;

      if (reference) {
        map.set(reference, record);
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
      ) >
      this.reconciliationTolerance
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

    for (const item of records) {
      const reference =
        item.reference ||
        item.providerReference;

      if (!reference) continue;

      if (seen.has(reference)) {
        duplicates.push(item);
      }

      seen.add(reference);
    }

    return duplicates;
  }

  /**
   * ==========================================================================
   * TRANSACTION MATCHING
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

      if (
        this.detectVariance(
          internalTx.amount,
          providerTx.amount
        )
      ) {
        variances.push({
          reference,
          internalAmount:
            internalTx.amount,
          providerAmount:
            providerTx.amount,
          difference:
            Number(providerTx.amount) -
            Number(internalTx.amount),
        });

        this.metrics.variancesDetected++;
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
      if (!internalMap.has(reference)) {
        missingInternal.push(providerTx);
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
   * LEDGER RECONCILIATION
   * ==========================================================================
   */

  reconcileLedger(
    transactions,
    ledgerEntries
  ) {
    const transactionTotal =
      transactions.reduce(
        (sum, tx) =>
          sum + Number(tx.amount || 0),
        0
      );

    const ledgerTotal =
      ledgerEntries.reduce(
        (sum, entry) =>
          sum + Number(entry.amount || 0),
        0
      );

    const variance =
      ledgerTotal - transactionTotal;

    return {
      transactionTotal,
      ledgerTotal,
      variance,
      balanced:
        Math.abs(variance) <=
        this.reconciliationTolerance,
    };
  }

  /**
   * ==========================================================================
   * SETTLEMENT VALIDATION
   * ==========================================================================
   */

  validateSettlement(
    expectedAmount,
    settledAmount
  ) {
    const difference =
      Number(settledAmount) -
      Number(expectedAmount);

    return {
      valid:
        Math.abs(difference) <=
        this.reconciliationTolerance,

      expectedAmount,
      settledAmount,
      difference,
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

    this.metrics.totalRuns++;

    try {
      await this.recordAudit(
        "RECONCILIATION_STARTED",
        {
          runId,
          date,
        }
      );

      const internalTransactions =
        await this.getInternalTransactions(
          date
        );

      const ledgerEntries =
        await this.getLedgerEntries(
          date
        );

      const providerData =
        await this.getProviderTransactions(
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
        currency: this.currency,
        reconciliationDate: date,

        summary: {
          internalTransactions:
            internalTransactions.length,

          providerTransactions:
            providerData.length,

          matched:
            transactionResults.matched.length,

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
            transactionResults
              .missingInternal,

          missingProvider:
            transactionResults
              .missingProvider,

          variances:
            transactionResults
              .variances,

          duplicateInternal,

          duplicateProvider,
        },

        generatedAt:
          new Date().toISOString(),
      };

      this.metrics.successfulRuns++;

      await this.recordAudit(
        "RECONCILIATION_COMPLETED",
        {
          runId,
          summary:
            report.summary,
        }
      );

      return report;
    } catch (error) {
      this.metrics.failedRuns++;

      await this.recordAudit(
        "RECONCILIATION_FAILED",
        {
          runId,
          error: error.message,
        }
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * HEALTH
   * ==========================================================================
   */

  healthCheck() {
    return {
      service:
        "AIRTEL_RECONCILIATION",
      provider:
        this.provider,
      healthy: true,
      timestamp:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * METRICS
   * ==========================================================================
   */

  getMetrics() {
    return {
      provider:
        this.provider,
      ...this.metrics,
      generatedAt:
        new Date().toISOString(),
    };
  }
}

module.exports =
  new AirtelReconciliationService();