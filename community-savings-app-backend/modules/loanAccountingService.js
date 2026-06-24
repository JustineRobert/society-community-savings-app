// backend/modules/loanAccountingService.js
/**
 * ============================================================================
 * LOAN ACCOUNTING SERVICE
 * ============================================================================
 *
 * TITech Community Capital
 *
 * Responsibilities
 *  - Loan Repayment Accounting
 *  - Loan Disbursement Accounting
 *  - Journal Entry Creation
 *  - General Ledger Integration Hooks
 *  - Audit Logging
 *  - Mobile Money Accounting Hooks
 *
 * STEP 9 REQUIREMENT
 * ----------------------------------------------------------------------------
 * Required Hook:
 *
 *   await loanAccountingService.recordRepayment()
 *
 * No architectural changes.
 *
 * ============================================================================
 */

const crypto = require("crypto");

let logger;

try {
  logger = require("./logger");
} catch (error) {
  logger = console;
}

class LoanAccountingService {
  constructor() {
    this.serviceName = "LoanAccountingService";

    this.metrics = {
      repaymentsRecorded: 0,
      disbursementsRecorded: 0,
      journalEntriesCreated: 0,
      auditEvents: 0,
      failures: 0,
    };
  }

  /**
   * ==========================================================================
   * RECORD LOAN REPAYMENT
   * ==========================================================================
   *
   * Integration Hook:
   *
   * await loanAccountingService.recordRepayment(...)
   *
   * ==========================================================================
   */

  async recordRepayment(payload = {}) {
    try {
      if (!payload.loanId) {
        throw new Error("loanId is required");
      }

      if (
        payload.amount === undefined ||
        payload.amount === null
      ) {
        throw new Error("amount is required");
      }

      const amount = Number(payload.amount);

      if (
        Number.isNaN(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "amount must be greater than zero"
        );
      }

      const accountingEntry = {
        entryId: crypto.randomUUID(),

        transactionType:
          "LOAN_REPAYMENT",

        provider:
          payload.provider ||
          "UNKNOWN",

        loanId:
          payload.loanId,

        memberId:
          payload.memberId || null,

        accountId:
          payload.accountId || null,

        repaymentId:
          payload.repaymentId || null,

        reference:
          payload.reference ||
          crypto.randomUUID(),

        amount,

        principalAmount:
          Number(
            payload.principalAmount || 0
          ),

        interestAmount:
          Number(
            payload.interestAmount || 0
          ),

        penaltyAmount:
          Number(
            payload.penaltyAmount || 0
          ),

        currency:
          payload.currency || "UGX",

        repaymentDate:
          payload.repaymentDate ||
          new Date().toISOString(),

        metadata:
          payload.metadata || {},

        createdAt:
          new Date().toISOString(),
      };

      /**
       * ==============================================================
       * EXISTING ACCOUNTING ENGINE HOOK
       * ==============================================================
       *
       * No architecture changes.
       *
       */

      await this.createJournalEntry(
        accountingEntry
      );

      await this.recordAudit(
        "LOAN_REPAYMENT_RECORDED",
        accountingEntry
      );

      this.metrics.repaymentsRecorded++;

      logger.info(
        "[LOAN ACCOUNTING] Repayment recorded",
        {
          loanId:
            accountingEntry.loanId,
          amount:
            accountingEntry.amount,
          reference:
            accountingEntry.reference,
        }
      );

      return {
        success: true,
        accountingEntry,
      };
    } catch (error) {
      this.metrics.failures++;

      logger.error(
        "[LOAN ACCOUNTING] Repayment failed",
        {
          error: error.message,
        }
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * RECORD LOAN DISBURSEMENT
   * ==========================================================================
   */

  async recordDisbursement(
    payload = {}
  ) {
    try {
      if (!payload.loanId) {
        throw new Error("loanId is required");
      }

      const entry = {
        entryId: crypto.randomUUID(),

        transactionType:
          "LOAN_DISBURSEMENT",

        provider:
          payload.provider ||
          "SYSTEM",

        loanId:
          payload.loanId,

        memberId:
          payload.memberId,

        reference:
          payload.reference ||
          crypto.randomUUID(),

        amount:
          Number(payload.amount || 0),

        currency:
          payload.currency || "UGX",

        createdAt:
          new Date().toISOString(),
      };

      await this.createJournalEntry(
        entry
      );

      await this.recordAudit(
        "LOAN_DISBURSEMENT_RECORDED",
        entry
      );

      this.metrics
        .disbursementsRecorded++;

      return {
        success: true,
        entry,
      };
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  /**
   * ==========================================================================
   * JOURNAL ENTRY HOOK
   * ==========================================================================
   *
   * Existing GL / Accounting Engine integration point.
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
        entryId:
          entry.entryId,
        transactionType:
          entry.transactionType,
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
   * AUDIT LOGGING
   * ==========================================================================
   */

  async recordAudit(
    event,
    payload = {}
  ) {
    this.metrics.auditEvents++;

    logger.info(
      "[LOAN ACCOUNTING AUDIT]",
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
   * HEALTH CHECK
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
      repaymentsRecorded: 0,
      disbursementsRecorded: 0,
      journalEntriesCreated: 0,
      auditEvents: 0,
      failures: 0,
    };
  }
}

module.exports =
  new LoanAccountingService();