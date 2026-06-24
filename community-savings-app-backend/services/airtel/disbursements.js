// backend/services/airtel/disbursements.js
/**
 * ============================================================================
 * AIRTEL MONEY DISBURSEMENTS SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Withdrawals
 *  - Loan Disbursements
 *  - Member Payouts
 *  - Bulk Transfers
 *  - Airtel Money Transfers API
 *  - Audit Logging
 *  - Settlement Hooks
 *  - Transaction Status Tracking
 *  - Retry Management
 *  - Idempotency Protection
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
  settlementService = require("../../modules/mobileMoneySettlementService");
} catch {
  settlementService = null;
}

class AirtelDisbursementService {
  constructor() {
    this.provider = "AIRTEL_MONEY";

    this.baseUrl =
      process.env.AIRTEL_MONEY_BASE_URL ||
      "https://openapiuat.airtel.africa";

    this.country =
      process.env.AIRTEL_COUNTRY ||
      process.env.DEFAULT_COUNTRY ||
      "UG";

    this.currency =
      process.env.DEFAULT_CURRENCY ||
      "UGX";

    this.timeout = Number(
      process.env.AIRTEL_TIMEOUT || 30000
    );

    this.maxRetries = Number(
      process.env.AIRTEL_MAX_RETRIES || 3
    );

    this.metrics = {
      withdrawals: 0,
      loanDisbursements: 0,
      bulkTransfers: 0,
      failedRequests: 0,
      successfulRequests: 0,
    };
  }

  /**
   * ==========================================================================
   * HELPERS
   * ==========================================================================
   */

  generateReference() {
    return crypto.randomUUID();
  }

  async recordAudit(action, payload = {}) {
    try {
      const auditPayload = {
        provider: this.provider,
        action,
        payload,
        timestamp: new Date(),
      };

      if (
        auditService &&
        typeof auditService.record === "function"
      ) {
        await auditService.record(auditPayload);
      }

      logger.info(
        `[AIRTEL DISBURSEMENTS] ${action}`,
        payload
      );
    } catch (error) {
      logger.error(
        "[AIRTEL DISBURSEMENTS] Audit Error",
        error
      );
    }
  }

  async ensureIdempotency(reference) {
    if (!Transaction?.findOne) {
      return;
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
  }

  async executeWithRetry(fn) {
    let lastError;

    for (
      let attempt = 1;
      attempt <= this.maxRetries;
      attempt++
    ) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        logger.error(
          `[AIRTEL DISBURSEMENTS] Retry ${attempt}/${this.maxRetries}`,
          error.message
        );

        if (attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, attempt * 1000)
          );
        }
      }
    }

    throw lastError;
  }

  async buildHeaders(reference) {
    const token =
      await authService.getAccessToken();

    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Country": this.country,
      "X-Currency": this.currency,
      "X-Reference-Id": reference,
    };
  }

  async createTransactionRecord(data) {
    if (!Transaction?.create) {
      return null;
    }

    return Transaction.create({
      provider: this.provider,
      transactionType:
        data.transactionType,
      reference: data.reference,
      externalReference:
        data.externalReference,
      amount: data.amount,
      currency: data.currency,
      phoneNumber: data.phoneNumber,
      status: data.status || "PENDING",
      providerStatus:
        data.providerStatus || "PENDING",
      metadata: data.metadata || {},
    });
  }

  /**
   * ==========================================================================
   * CORE DISBURSEMENT
   * ==========================================================================
   */

  async initiateTransfer({
    amount,
    phoneNumber,
    transactionType,
    metadata = {},
    reference,
  }) {
    reference =
      reference ||
      this.generateReference();

    await this.ensureIdempotency(
      reference
    );

    const payload = {
      reference,
      payee: {
        msisdn: phoneNumber,
        country: this.country,
        currency: this.currency,
      },
      transaction: {
        amount: String(amount),
        id: reference,
      },
    };

    await this.recordAudit(
      "DISBURSEMENT_INITIATED",
      payload
    );

    const result =
      await this.executeWithRetry(
        async () => {
          const headers =
            await this.buildHeaders(
              reference
            );

          const response =
            await axios.post(
              `${this.baseUrl}/merchant/v1/payments/`,
              payload,
              {
                headers,
                timeout:
                  this.timeout,
              }
            );

          return response.data;
        }
      );

    await this.createTransactionRecord({
      transactionType,
      reference,
      amount,
      currency: this.currency,
      phoneNumber,
      providerStatus:
        result?.status ||
        "PENDING",
      metadata,
    });

    this.metrics.successfulRequests++;

    return {
      success: true,
      provider: this.provider,
      reference,
      transactionType,
      amount,
      currency: this.currency,
      status:
        result?.status ||
        "PENDING",
      providerResponse: result,
      createdAt:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * WITHDRAWAL
   * ==========================================================================
   */

  async withdraw(payload = {}) {
    this.metrics.withdrawals++;

    return this.initiateTransfer({
      ...payload,
      transactionType:
        "WITHDRAWAL",
    });
  }

  /**
   * ==========================================================================
   * LOAN DISBURSEMENT
   * ==========================================================================
   */

  async disburseLoan(payload = {}) {
    this.metrics.loanDisbursements++;

    return this.initiateTransfer({
      ...payload,
      transactionType:
        "LOAN_DISBURSEMENT",
    });
  }

  /**
   * ==========================================================================
   * GENERIC DISBURSE
   * ==========================================================================
   */

  async disburse(payload = {}) {
    return this.disburseLoan(payload);
  }

  /**
   * ==========================================================================
   * BULK TRANSFERS
   * ==========================================================================
   */

  async bulkTransfer(
    transactions = []
  ) {
    this.metrics.bulkTransfers++;

    const results =
      await Promise.allSettled(
        transactions.map((tx) =>
          this.disburse(tx)
        )
      );

    const successful =
      results.filter(
        (r) => r.status === "fulfilled"
      ).length;

    const failed =
      results.length - successful;

    await this.recordAudit(
      "BULK_TRANSFER_COMPLETED",
      {
        total:
          transactions.length,
        successful,
        failed,
      }
    );

    return {
      success: true,
      provider: this.provider,
      total:
        transactions.length,
      successful,
      failed,
      results,
      completedAt:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * STATUS QUERY
   * ==========================================================================
   */

  async getStatus(reference) {
    const headers =
      await this.buildHeaders(reference);

    const response =
      await axios.get(
        `${this.baseUrl}/standard/v1/payments/${reference}`,
        {
          headers,
          timeout: this.timeout,
        }
      );

    return {
      success: true,
      provider: this.provider,
      reference,
      status:
        response.data?.data
          ?.transaction?.status ||
        "UNKNOWN",
      providerResponse:
        response.data,
      checkedAt:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * SETTLEMENT
   * ==========================================================================
   */

  async postSettlement(transaction) {
    try {
      if (
        settlementService &&
        typeof settlementService.processTransaction ===
          "function"
      ) {
        await settlementService.processTransaction(
          transaction
        );
      }
    } catch (error) {
      logger.error(
        "[AIRTEL DISBURSEMENTS] Settlement Error",
        error
      );
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
        "AIRTEL_DISBURSEMENTS",
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
  new AirtelDisbursementService();