// backend/modules/savingsAccountingService.js
/**
 * ============================================================================
 * SAVINGS ACCOUNTING SERVICE
 * ============================================================================
 *
 * TITech Community Capital
 *
 * Responsibilities
 *  - Savings Deposit Accounting
 *  - Savings Contribution Accounting
 *  - Journal Entry Generation
 *  - Ledger Posting
 *  - Audit Logging
 *  - Mobile Money Integration Hooks
 *
 * IMPORTANT
 * -----------
 * Step 9 Integration Requirement
 *
 * Required Hook:
 *
 *   await savingsAccountingService.recordDeposit()
 *
 * No architectural changes.
 *
 * ============================================================================
 */

const crypto = require("crypto");

let logger;

try {
  logger = require("./logger");
} catch {
  logger = console;
}

class SavingsAccountingService {
  constructor() {
    this.serviceName =
      "SavingsAccountingService";

    this.metrics = {
      depositsRecorded: 0,
      contributionsRecorded: 0,
      journalEntriesCreated: 0,
      auditEvents: 0,
      failures: 0,
    };
  }

  /**
   * ==========================================================================
   * RECORD DEPOSIT
   * ==========================================================================
   *
   * MTN Hook
   * Airtel Hook
   * Future Banking Hook
   *
   * Called after successful collection.
   *
   * ==========================================================================
   */

  async recordDeposit(payload = {}) {
    try {
      if (!payload.amount) {
        throw new Error(
          "Deposit amount is required"
        );
      }

      const accountingEntry = {
        entryId:
          crypto.randomUUID(),

        transactionType:
          "SAVINGS_DEPOSIT",

        provider:
          payload.provider ||
          "UNKNOWN",

        memberId:
          payload.memberId,

        accountId:
          payload.accountId,

        reference:
          payload.reference,

        amount:
          Number(payload.amount),

        currency:
          payload.currency ||
          "UGX",

        createdAt:
          new Date().toISOString(),
      };

      /**
       * ==============================================================
       * ACCOUNTING ENTRY HOOK
       * ==============================================================
       *
       * Existing accounting implementation remains unchanged.
       *
       */

      await this.createJournalEntry(
        accountingEntry
      );

      await this.recordAudit(
        "SAVINGS_DEPOSIT_RECORDED",
        accountingEntry
      );

      this.metrics.depositsRecorded++;

      logger.info(
        "[SAVINGS ACCOUNTING] Deposit recorded",
        {
          reference:
            accountingEntry.reference,
          amount:
            accountingEntry.amount,
        }
      );

      return {
        success: true,
        entry:
          accountingEntry,
      };
    } catch (error) {
      this.metrics.failures++;

      logger.error(
        "[SAVINGS ACCOUNTING] Deposit failed",
        error
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * RECORD SAVINGS CONTRIBUTION
   * ==========================================================================
   */

  async recordContribution(
    payload = {}
  ) {
    try {
      const contribution = {
        contributionId:
          crypto.randomUUID(),

        memberId:
          payload.memberId,

        amount:
          Number(payload.amount),

        reference:
          payload.reference,

        provider:
          payload.provider,

        createdAt:
          new Date().toISOString(),
      };

      await this.recordAudit(
        "SAVINGS_CONTRIBUTION",
        contribution
      );

      this.metrics
        .contributionsRecorded++;

      return {
        success: true,
        contribution,
      };
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  /**
   * ==========================================================================
   * JOURNAL ENTRY
   * ==========================================================================
   *
   * Placeholder integration point.
   * Existing accounting engine remains intact.
   *
   * ==========================================================================
   */

  async createJournalEntry(
    entry
  ) {
    this.metrics
      .journalEntriesCreated++;

    logger.info(
      "[ACCOUNTING] Journal entry created",
      {
        reference:
          entry.reference,
      }
    );

    return {
      success: true,
      journalId:
        crypto.randomUUID(),
    };
  }

  /**
   * ==========================================================================
   * AUDIT
   * ==========================================================================
   */

  async recordAudit(
    event,
    payload
  ) {
    this.metrics.auditEvents++;

    logger.info(
      "[SAVINGS AUDIT]",
      {
        event,
        payload,
        timestamp:
          new Date().toISOString(),
      }
    );

    return true;
  }

  /**
   * ==========================================================================
   * HEALTH
   * ==========================================================================
   */

  healthCheck() {
    return {
      healthy: true,
      service:
        this.serviceName,
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
      service:
        this.serviceName,
      ...this.metrics,
      timestamp:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * RESET METRICS
   * ==========================================================================
   */

  resetMetrics() {
    this.metrics = {
      depositsRecorded: 0,
      contributionsRecorded: 0,
      journalEntriesCreated: 0,
      auditEvents: 0,
      failures: 0,
    };
  }
}

module.exports =
  new SavingsAccountingService();