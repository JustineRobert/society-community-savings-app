// backend/services/airtel/collections.js
/**
 * ============================================================================
 * AIRTEL MONEY COLLECTIONS SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Deposits
 *  - Savings Contributions
 *  - Loan Repayments
 *  - Airtel Collections API Integration
 *  - Idempotency Protection
 *  - Audit Logging
 *  - Settlement Hooks
 *  - Transaction Tracking
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

class AirtelCollectionsService {
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
      deposits: 0,
      savingsContributions: 0,
      loanRepayments: 0,
      failedRequests: 0,
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
      const entry = {
        provider: this.provider,
        action,
        payload,
        timestamp: new Date(),
      };

      if (
        auditService &&
        typeof auditService.record === "function"
      ) {
        await auditService.record(entry);
      }

      logger.info(
        `[AIRTEL COLLECTIONS] ${action}`,
        payload
      );
    } catch (error) {
      logger.error(
        "[AIRTEL COLLECTIONS] Audit Error",
        error
      );
    }
  }

  async createTransactionRecord(data) {
    if (!Transaction?.create) {
      return null;
    }

    return Transaction.create({
      provider: this.provider,
      reference: data.reference,
      externalReference:
        data.externalReference,
      transactionType:
        data.transactionType,
      amount: data.amount,
      currency: data.currency,
      phoneNumber: data.phoneNumber,
      status: data.status || "PENDING",
      providerStatus:
        data.providerStatus ||
        "PENDING",
      metadata:
        data.metadata || {},
    });
  }

  async ensureIdempotency(reference) {
    if (
      !Transaction?.findOne ||
      !reference
    ) {
      return;
    }

    const existing =
      await Transaction.findOne({
        reference,
      });

    if (existing) {
      throw new Error(
        `Duplicate reference detected: ${reference}`
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
          `[AIRTEL COLLECTIONS] Attempt ${attempt} failed`,
          error.message
        );

        if (
          attempt < this.maxRetries
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                1000 * attempt
              )
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
      "Content-Type":
        "application/json",
      Accept:
        "application/json",
      "X-Country":
        this.country,
      "X-Currency":
        this.currency,
      "X-Reference-Id":
        reference,
    };
  }

  /**
   * ==========================================================================
   * COLLECTION REQUEST
   * ==========================================================================
   */

  async initiateCollection({
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
      subscriber: {
        country:
          this.country,
        currency:
          this.currency,
        msisdn:
          phoneNumber,
      },
      transaction: {
        amount:
          String(amount),
        id: reference,
      },
    };

    await this.recordAudit(
      "COLLECTION_INITIATED",
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

    await this.createTransactionRecord(
      {
        reference,
        transactionType,
        amount,
        currency:
          this.currency,
        phoneNumber,
        status:
          "PENDING",
        providerStatus:
          result?.status ||
          "PENDING",
        metadata,
      }
    );

    return {
      success: true,
      provider:
        this.provider,
      reference,
      transactionType,
      amount,
      currency:
        this.currency,
      status:
        result?.status ||
        "PENDING",
      providerResponse:
        result,
      createdAt:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * DEPOSIT
   * ==========================================================================
   */

  async deposit(payload = {}) {
    this.metrics.deposits++;

    return this.initiateCollection({
      ...payload,
      transactionType:
        "DEPOSIT",
    });
  }

  /**
   * ==========================================================================
   * SAVINGS CONTRIBUTION
   * ==========================================================================
   */

  async contributeSavings(
    payload = {}
  ) {
    this.metrics
      .savingsContributions++;

    return this.initiateCollection({
      ...payload,
      transactionType:
        "SAVINGS_CONTRIBUTION",
    });
  }

  /**
   * ==========================================================================
   * LOAN REPAYMENT
   * ==========================================================================
   */

  async repayLoan(
    payload = {}
  ) {
    this.metrics.loanRepayments++;

    return this.initiateCollection({
      ...payload,
      transactionType:
        "LOAN_REPAYMENT",
    });
  }

  /**
   * ==========================================================================
   * STATUS QUERY
   * ==========================================================================
   */

  async getStatus(reference) {
    const headers =
      await this.buildHeaders(
        reference
      );

    const response =
      await axios.get(
        `${this.baseUrl}/standard/v1/payments/${reference}`,
        {
          headers,
          timeout:
            this.timeout,
        }
      );

    return {
      success: true,
      provider:
        this.provider,
      reference,
      status:
        response.data?.data
          ?.transaction?.status ||
        "UNKNOWN",
      providerResponse:
        response.data,
    };
  }

  /**
   * ==========================================================================
   * SETTLEMENT
   * ==========================================================================
   */

  async postSettlement(
    transaction
  ) {
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
        "[AIRTEL COLLECTIONS] Settlement Error",
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
        "AIRTEL_COLLECTIONS",
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
      ...this.metrics,
      provider:
        this.provider,
      generatedAt:
        new Date().toISOString(),
    };
  }
}

module.exports =
  new AirtelCollectionsService();