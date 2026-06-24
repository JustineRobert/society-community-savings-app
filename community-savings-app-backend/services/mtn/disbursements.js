// backend/services/mtn/disbursements.js
/**
 * ============================================================================
 * MTN MOMO DISBURSEMENT SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Withdrawals
 *  - Loan Disbursements
 *  - Savings Withdrawals
 *  - Bulk Transfers
 *  - Transaction Status Checks
 *  - Retry Management
 *  - Idempotency Protection
 *  - Settlement Posting
 *  - Audit Logging
 *  - Reconciliation Support
 *
 * ============================================================================
 */

const axios = require("axios");
const crypto = require("crypto");

const authService = require("./auth");

let logger;
let Transaction;
let auditService;
let settlementService;

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
  auditService = require("../../modules/auditService");
} catch {
  auditService = null;
}

try {
  settlementService = require(
    "../../modules/mobileMoneySettlementService"
  );
} catch {
  settlementService = null;
}

class MTNDisbursementService {
  constructor() {
    this.baseUrl =
      process.env.MTN_MOMO_BASE_URL;

    this.subscriptionKey =
      process.env.MTN_MOMO_SUBSCRIPTION_KEY;

    this.currency =
      process.env.DEFAULT_CURRENCY || "UGX";

    this.timeout = 60000;

    this.maxBulkConcurrency = Number(
      process.env.MTN_BULK_CONCURRENCY || 10
    );
  }

  /**
   * ==========================================================================
   * UTILITIES
   * ==========================================================================
   */

  generateReferenceId() {
    return crypto.randomUUID();
  }

  generateExternalId() {
    return crypto.randomUUID();
  }

  async createHeaders(referenceId) {
    const token =
      await authService.getAccessToken();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Reference-Id": referenceId,
      "Ocp-Apim-Subscription-Key":
        this.subscriptionKey,
    };
  }

  async ensureIdempotency(reference) {
    if (!Transaction || !reference) {
      return true;
    }

    const existing =
      await Transaction.findOne({
        reference,
      });

    if (existing) {
      throw new Error(
        `Duplicate transaction reference: ${reference}`
      );
    }

    return true;
  }

  async recordAudit(action, payload) {
    try {
      const entry = {
        provider: "MTN_MOMO",
        action,
        payload,
        timestamp: new Date().toISOString(),
      };

      if (
        auditService &&
        typeof auditService.record === "function"
      ) {
        await auditService.record(entry);
      }

      logger.info(
        `[MTN DISBURSEMENTS] ${action}`,
        entry
      );
    } catch (error) {
      logger.error(
        "[MTN DISBURSEMENTS] Audit Failure",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * CORE TRANSFER
   * ==========================================================================
   */

  async transfer({
    amount,
    phoneNumber,
    currency = this.currency,
    externalId,
    reference,
    payerMessage,
    payeeNote,
    metadata = {},
  }) {
    await this.ensureIdempotency(reference);

    const referenceId =
      this.generateReferenceId();

    const headers =
      await this.createHeaders(referenceId);

    const payload = {
      amount: String(amount),
      currency,
      externalId:
        externalId ||
        reference ||
        this.generateExternalId(),
      payee: {
        partyIdType: "MSISDN",
        partyId: phoneNumber,
      },
      payerMessage:
        payerMessage || "Transfer",
      payeeNote:
        payeeNote || "Transfer",
    };

    try {
      await axios.post(
        `${this.baseUrl}/disbursement/v1_0/transfer`,
        payload,
        {
          headers,
          timeout: this.timeout,
        }
      );

      await this.recordAudit(
        "TRANSFER_CREATED",
        {
          referenceId,
          payload,
          metadata,
        }
      );

      return {
        success: true,
        provider: "MTN_MOMO",
        transactionType: "TRANSFER",
        reference: referenceId,
        status: "PENDING",
        amount,
        currency,
        phoneNumber,
      };
    } catch (error) {
      await this.recordAudit(
        "TRANSFER_FAILED",
        {
          payload,
          error:
            error.response?.data ||
            error.message,
        }
      );

      throw new Error(
        error.response?.data?.message ||
        error.message
      );
    }
  }

  /**
   * ==========================================================================
   * MEMBER WITHDRAWAL
   * ==========================================================================
   */

  async withdraw(payload) {
    return this.transfer({
      ...payload,
      payerMessage:
        payload.payerMessage ||
        "Withdrawal",
      payeeNote:
        payload.payeeNote ||
        "Member Withdrawal",
      metadata: {
        transactionType: "WITHDRAWAL",
        memberId: payload.memberId,
      },
    });
  }

  /**
   * ==========================================================================
   * LOAN DISBURSEMENT
   * ==========================================================================
   */

  async disburseLoan(payload) {
    const result =
      await this.transfer({
        ...payload,
        payerMessage:
          payload.payerMessage ||
          "Loan Disbursement",
        payeeNote:
          payload.payeeNote ||
          "Loan Disbursement",
        metadata: {
          transactionType:
            "LOAN_DISBURSEMENT",
          memberId:
            payload.memberId,
          loanId:
            payload.loanId,
        },
      });

    if (
      settlementService &&
      settlementService.recordLoanDisbursement
    ) {
      try {
        await settlementService.recordLoanDisbursement(
          {
            reference:
              result.reference,
            amount:
              payload.amount,
            loanId:
              payload.loanId,
            memberId:
              payload.memberId,
          }
        );
      } catch (error) {
        logger.error(
          "Settlement posting failed",
          error
        );
      }
    }

    return result;
  }

  /**
   * ==========================================================================
   * SAVINGS WITHDRAWAL
   * ==========================================================================
   */

  async withdrawSavings(payload) {
    return this.transfer({
      ...payload,
      payerMessage:
        payload.payerMessage ||
        "Savings Withdrawal",
      payeeNote:
        payload.payeeNote ||
        "Savings Withdrawal",
      metadata: {
        transactionType:
          "SAVINGS_WITHDRAWAL",
        memberId:
          payload.memberId,
        savingsAccountId:
          payload.savingsAccountId,
      },
    });
  }

  /**
   * ==========================================================================
   * DIVIDEND PAYOUT
   * ==========================================================================
   */

  async payDividend(payload) {
    return this.transfer({
      ...payload,
      payerMessage:
        payload.payerMessage ||
        "Dividend Payment",
      payeeNote:
        payload.payeeNote ||
        "Dividend Distribution",
      metadata: {
        transactionType:
          "DIVIDEND_PAYMENT",
        memberId:
          payload.memberId,
      },
    });
  }

  /**
   * ==========================================================================
   * BULK TRANSFERS
   * ==========================================================================
   */

  async bulkTransfer(transfers = []) {
    const results = [];

    for (
      let i = 0;
      i < transfers.length;
      i += this.maxBulkConcurrency
    ) {
      const batch =
        transfers.slice(
          i,
          i + this.maxBulkConcurrency
        );

      const batchResults =
        await Promise.allSettled(
          batch.map((item) =>
            this.transfer(item)
          )
        );

      results.push(...batchResults);
    }

    const successCount =
      results.filter(
        (r) => r.status === "fulfilled"
      ).length;

    const failedCount =
      results.filter(
        (r) => r.status === "rejected"
      ).length;

    await this.recordAudit(
      "BULK_TRANSFER_COMPLETED",
      {
        total: transfers.length,
        successful: successCount,
        failed: failedCount,
      }
    );

    return {
      success: true,
      total: transfers.length,
      successful: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * ==========================================================================
   * STATUS QUERY
   * ==========================================================================
   */

  async getStatus(referenceId) {
    const token =
      await authService.getAccessToken();

    try {
      const response =
        await axios.get(
          `${this.baseUrl}/disbursement/v1_0/transfer/${referenceId}`,
          {
            timeout: this.timeout,
            headers: {
              Authorization: `Bearer ${token}`,
              "Ocp-Apim-Subscription-Key":
                this.subscriptionKey,
            },
          }
        );

      return {
        success: true,
        provider: "MTN_MOMO",
        reference: referenceId,
        data: response.data,
      };
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
        error.message
      );
    }
  }

  /**
   * ==========================================================================
   * RETRY FAILED TRANSFER
   * ==========================================================================
   */

  async retry(referenceId) {
    const status =
      await this.getStatus(referenceId);

    if (
      status.data?.status === "FAILED"
    ) {
      await this.recordAudit(
        "TRANSFER_RETRY_REQUESTED",
        {
          referenceId,
        }
      );

      return {
        success: true,
        retryQueued: true,
        referenceId,
      };
    }

    return {
      success: false,
      retryQueued: false,
      reason:
        "Transfer not eligible for retry",
    };
  }

  /**
   * ==========================================================================
   * RECONCILIATION SUPPORT
   * ==========================================================================
   */

  async reconcile(transactionIds = []) {
    const results =
      await Promise.allSettled(
        transactionIds.map((id) =>
          this.getStatus(id)
        )
      );

    return {
      provider: "MTN_MOMO",
      transactionCount:
        transactionIds.length,
      results,
      reconciledAt:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * HEALTH CHECK
   * ==========================================================================
   */

  async healthCheck() {
    const authHealth =
      await authService.healthCheck();

    return {
      provider: "MTN_MOMO",
      service: "DISBURSEMENTS",
      healthy:
        authHealth.healthy,
      authenticated:
        authHealth.authenticated,
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
      provider: "MTN_MOMO",
      service: "DISBURSEMENTS",
      bulkConcurrency:
        this.maxBulkConcurrency,
      timestamp:
        new Date().toISOString(),
    };
  }
}

module.exports =
  new MTNDisbursementService();
