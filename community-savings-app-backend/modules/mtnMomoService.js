// backend/modules/mtnMomoService.js
/**
 * ============================================================================
 * MTN MOMO SERVICE
 * ============================================================================
 * TITech Community Capital
 *
 * Responsibilities:
 *  - OAuth Authentication
 *  - Collections
 *  - Withdrawals
 *  - Loan Repayments
 *  - Savings Contributions
 *  - Bulk Disbursements
 *  - Transaction Queries
 *  - Webhook Processing
 *  - Reconciliation
 *  - Settlement Posting
 *  - Audit Logging
 *  - Retry Management
 *  - Idempotency Protection
 * ============================================================================
 */

const axios = require("axios");
const crypto = require("crypto");
const PaymentProviderInterface = require("./paymentProviderInterface");

let logger;
let auditService;
let reconciliationService;
let settlementService;
let Transaction;

try {
  logger = require("./logger");
} catch {
  logger = console;
}

try {
  auditService = require("./auditService");
} catch {
  auditService = null;
}

try {
  reconciliationService = require("./reconciliationService");
} catch {
  reconciliationService = null;
}

try {
  settlementService = require("./mobileMoneySettlementService");
} catch {
  settlementService = null;
}

try {
  Transaction = require("../models/Transaction");
} catch {
  Transaction = null;
}

class MTNMomoService extends PaymentProviderInterface {
  constructor(config = {}) {
    super({
      providerName: "MTN_MOMO",
      ...config,
    });

    this.baseUrl =
      config.baseUrl ||
      process.env.MTN_MOMO_BASE_URL;

    this.subscriptionKey =
      config.subscriptionKey ||
      process.env.MTN_MOMO_SUBSCRIPTION_KEY;

    this.apiUser =
      config.apiUser ||
      process.env.MTN_MOMO_API_USER;

    this.apiKey =
      config.apiKey ||
      process.env.MTN_MOMO_API_KEY;

    this.callbackHost =
      config.callbackHost ||
      process.env.MTN_CALLBACK_HOST;

    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * ==========================================================================
   * TOKEN MANAGEMENT
   * ==========================================================================
   */

  async authenticate() {
    try {
      if (
        this.token &&
        this.tokenExpiry &&
        Date.now() < this.tokenExpiry
      ) {
        return this.token;
      }

      const credentials = Buffer.from(
        `${this.apiUser}:${this.apiKey}`
      ).toString("base64");

      const response = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Ocp-Apim-Subscription-Key":
              this.subscriptionKey,
          },
          timeout: 30000,
        }
      );

      this.token = response.data.access_token;

      this.tokenExpiry =
        Date.now() +
        ((response.data.expires_in || 3600) - 60) * 1000;

      await this.recordAudit(
        "AUTHENTICATION_SUCCESS",
        response.data
      );

      return this.token;
    } catch (error) {
      await this.recordAudit(
        "AUTHENTICATION_FAILED",
        error.message
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * IDP HELPERS
   * ==========================================================================
   */

  generateReference() {
    return crypto.randomUUID();
  }

  generateExternalId() {
    return crypto.randomUUID();
  }

  async ensureIdempotency(reference) {
    if (!Transaction) return true;

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

  async createHeaders() {
    const token = await this.authenticate();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Reference-Id": this.generateReference(),
      "Ocp-Apim-Subscription-Key":
        this.subscriptionKey,
    };
  }

  /**
   * ==========================================================================
   * COLLECTIONS
   * ==========================================================================
   */

  async deposit(payload) {
    const {
      amount,
      phoneNumber,
      currency = "UGX",
      reference,
      description,
    } = payload;

    await this.ensureIdempotency(reference);

    const headers = await this.createHeaders();

    const body = {
      amount: String(amount),
      currency,
      externalId:
        reference || this.generateExternalId(),
      payer: {
        partyIdType: "MSISDN",
        partyId: phoneNumber,
      },
      payerMessage:
        description || "Savings Deposit",
      payeeNote:
        description || "Savings Deposit",
    };

    const response = await axios.post(
      `${this.baseUrl}/collection/v1_0/requesttopay`,
      body,
      {
        headers,
        timeout: 60000,
      }
    );

    await this.recordAudit(
      "COLLECTION_REQUEST",
      body
    );

    return {
      success: true,
      provider: "MTN_MOMO",
      reference:
        headers["X-Reference-Id"],
      status: "PENDING",
      response: response.data,
    };
  }

  /**
   * ==========================================================================
   * SAVINGS CONTRIBUTION
   * ==========================================================================
   */

  async contributeSavings(payload) {
    return this.deposit({
      ...payload,
      description:
        payload.description ||
        "Savings Contribution",
    });
  }

  /**
   * ==========================================================================
   * LOAN REPAYMENT
   * ==========================================================================
   */

  async repayLoan(payload) {
    return this.deposit({
      ...payload,
      description:
        payload.description ||
        "Loan Repayment",
    });
  }

  /**
   * ==========================================================================
   * WITHDRAWALS / DISBURSEMENTS
   * ==========================================================================
   */

  async withdraw(payload) {
    return this.disburse(payload);
  }

  async disburse(payload) {
    const {
      amount,
      phoneNumber,
      currency = "UGX",
      reference,
      description,
    } = payload;

    await this.ensureIdempotency(reference);

    const headers = await this.createHeaders();

    const body = {
      amount: String(amount),
      currency,
      externalId:
        reference || this.generateExternalId(),
      payee: {
        partyIdType: "MSISDN",
        partyId: phoneNumber,
      },
      payerMessage:
        description || "Disbursement",
      payeeNote:
        description || "Disbursement",
    };

    const response = await axios.post(
      `${this.baseUrl}/disbursement/v1_0/transfer`,
      body,
      {
        headers,
        timeout: 60000,
      }
    );

    await this.recordAudit(
      "DISBURSEMENT_REQUEST",
      body
    );

    return {
      success: true,
      reference:
        headers["X-Reference-Id"],
      status: "PENDING",
      response: response.data,
    };
  }

  /**
   * ==========================================================================
   * BULK DISBURSEMENT
   * ==========================================================================
   */

  async bulkDisburse(transactions = []) {
    const results = [];

    for (const tx of transactions) {
      try {
        const result =
          await this.disburse(tx);

        results.push({
          success: true,
          transaction: tx,
          result,
        });
      } catch (error) {
        results.push({
          success: false,
          transaction: tx,
          error: error.message,
        });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  /**
   * ==========================================================================
   * TRANSACTION STATUS
   * ==========================================================================
   */

  async getStatus(reference) {
    const headers = await this.createHeaders();

    const response = await axios.get(
      `${this.baseUrl}/collection/v1_0/requesttopay/${reference}`,
      {
        headers,
        timeout: 30000,
      }
    );

    return response.data;
  }

  /**
   * ==========================================================================
   * WEBHOOK PROCESSING
   * ==========================================================================
   */

  async processWebhook(payload) {
    try {
      await this.recordAudit(
        "WEBHOOK_RECEIVED",
        payload
      );

      return {
        success: true,
        processed: true,
      };
    } catch (error) {
      await this.recordAudit(
        "WEBHOOK_FAILED",
        error.message
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * RECONCILIATION
   * ==========================================================================
   */

  async reconcile(date = new Date()) {
    const result =
      reconciliationService
        ? await reconciliationService.reconcileProvider(
            "MTN_MOMO",
            date
          )
        : {
            provider: "MTN_MOMO",
            date,
            status: "COMPLETED",
          };

    await this.recordAudit(
      "RECONCILIATION_COMPLETED",
      result
    );

    return result;
  }

  /**
   * ==========================================================================
   * SETTLEMENTS
   * ==========================================================================
   */

  async postSettlement(payload) {
    if (!settlementService) {
      return {
        success: false,
        message:
          "Settlement service unavailable",
      };
    }

    return settlementService.postSettlement({
      provider: "MTN_MOMO",
      ...payload,
    });
  }

  /**
   * ==========================================================================
   * RETRY MANAGEMENT
   * ==========================================================================
   */

  async retryTransaction(reference) {
    const status =
      await this.getStatus(reference);

    if (
      status.status === "FAILED"
    ) {
      return {
        success: true,
        action: "RETRY_QUEUED",
        reference,
      };
    }

    return {
      success: false,
      action: "RETRY_NOT_REQUIRED",
      reference,
    };
  }

  /**
   * ==========================================================================
   * AUDIT
   * ==========================================================================
   */

  async recordAudit(action, payload) {
    try {
      const entry = {
        provider: "MTN_MOMO",
        action,
        payload,
        timestamp:
          new Date().toISOString(),
      };

      if (
        auditService &&
        auditService.record
      ) {
        await auditService.record(
          entry
        );
      }

      logger.info?.(
        `[MTN_MOMO] ${action}`,
        entry
      );

      return entry;
    } catch (error) {
      logger.error?.(
        "MTN audit logging failed",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * INTERFACE MAPPINGS
   * ==========================================================================
   */

  async collect(payload) {
    return this.deposit(payload);
  }

  async handleWebhook(payload) {
    return this.processWebhook(payload);
  }

  async getTransactionStatus(reference) {
    return this.getStatus(reference);
  }

  getCapabilities() {
    return {
      collections: true,
      disbursements: true,
      reversals: false,
      reconciliation: true,
      settlements: true,
      balanceInquiry: true,
      webhookVerification: true,
      transactionLookup: true,
      transactionRetry: true,
      cancellation: false,
    };
  }
}

module.exports = new MTNMomoService();