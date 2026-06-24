// backend/services/mtn/collections.js
/**
 * ============================================================================
 * MTN MOMO COLLECTIONS SERVICE
 * ============================================================================
 *
 * Responsibilities:
 *  - Deposits
 *  - Savings Contributions
 *  - Loan Repayments
 *  - Request To Pay
 *  - Collection Status Checks
 *  - Idempotency Protection
 *  - Audit Logging
 *  - Retry Handling
 *  - Settlement Integration
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

class MTNCollectionsService {
  constructor() {
    this.baseUrl =
      process.env.MTN_MOMO_BASE_URL;

    this.subscriptionKey =
      process.env.MTN_MOMO_SUBSCRIPTION_KEY;

    this.currency =
      process.env.DEFAULT_CURRENCY ||
      "UGX";

    this.timeout = 60000;
  }

  /**
   * ==========================================================================
   * UTILITIES
   * ==========================================================================
   */

  generateReference() {
    return crypto.randomUUID();
  }

  generateExternalId() {
    return crypto.randomUUID();
  }

  async buildHeaders(referenceId) {
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

      logger.info(
        `[MTN COLLECTIONS] ${action}`,
        entry
      );
    } catch (error) {
      logger.error(
        "Audit logging failed",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * CORE REQUEST TO PAY
   * ==========================================================================
   */

  async requestToPay({
    amount,
    phoneNumber,
    currency = this.currency,
    externalId,
    payerMessage,
    payeeNote,
    reference,
    metadata = {},
  }) {
    await this.ensureIdempotency(
      reference
    );

    const referenceId =
      this.generateReference();

    const headers =
      await this.buildHeaders(
        referenceId
      );

    const payload = {
      amount: String(amount),
      currency,
      externalId:
        externalId ||
        reference ||
        this.generateExternalId(),
      payer: {
        partyIdType: "MSISDN",
        partyId: phoneNumber,
      },
      payerMessage,
      payeeNote,
    };

    try {
      await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        payload,
        {
          headers,
          timeout: this.timeout,
        }
      );

      await this.recordAudit(
        "REQUEST_TO_PAY_CREATED",
        {
          referenceId,
          payload,
          metadata,
        }
      );

      return {
        success: true,
        provider: "MTN_MOMO",
        reference: referenceId,
        status: "PENDING",
        amount,
        phoneNumber,
        currency,
      };
    } catch (error) {
      await this.recordAudit(
        "REQUEST_TO_PAY_FAILED",
        {
          error:
            error.response?.data ||
            error.message,
          payload,
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
   * DEPOSITS
   * ==========================================================================
   */

  async deposit(payload) {
    return this.requestToPay({
      ...payload,
      payerMessage:
        payload.payerMessage ||
        "Deposit",
      payeeNote:
        payload.payeeNote ||
        "Community Capital Deposit",
      metadata: {
        transactionType:
          "DEPOSIT",
      },
    });
  }

  /**
   * ==========================================================================
   * SAVINGS CONTRIBUTIONS
   * ==========================================================================
   */

  async contributeSavings(payload) {
    const result =
      await this.requestToPay({
        ...payload,
        payerMessage:
          payload.payerMessage ||
          "Savings Contribution",
        payeeNote:
          payload.payeeNote ||
          "Savings Contribution",
        metadata: {
          transactionType:
            "SAVINGS_CONTRIBUTION",
          memberId:
            payload.memberId,
          savingsAccountId:
            payload.savingsAccountId,
        },
      });

    if (
      settlementService &&
      settlementService.recordContribution
    ) {
      try {
        await settlementService.recordContribution(
          {
            amount:
              payload.amount,
            memberId:
              payload.memberId,
            reference:
              result.reference,
          }
        );
      } catch (err) {
        logger.error(
          "Settlement contribution recording failed",
          err
        );
      }
    }

    return result;
  }

  /**
   * ==========================================================================
   * LOAN REPAYMENTS
   * ==========================================================================
   */

  async repayLoan(payload) {
    const result =
      await this.requestToPay({
        ...payload,
        payerMessage:
          payload.payerMessage ||
          "Loan Repayment",
        payeeNote:
          payload.payeeNote ||
          "Loan Repayment",
        metadata: {
          transactionType:
            "LOAN_REPAYMENT",
          memberId:
            payload.memberId,
          loanId:
            payload.loanId,
        },
      });

    if (
      settlementService &&
      settlementService.recordLoanRepayment
    ) {
      try {
        await settlementService.recordLoanRepayment(
          {
            amount:
              payload.amount,
            loanId:
              payload.loanId,
            memberId:
              payload.memberId,
            reference:
              result.reference,
          }
        );
      } catch (err) {
        logger.error(
          "Loan settlement posting failed",
          err
        );
      }
    }

    return result;
  }

  /**
   * ==========================================================================
   * TRANSACTION STATUS
   * ==========================================================================
   */

  async getStatus(referenceId) {
    const token =
      await authService.getAccessToken();

    try {
      const response =
        await axios.get(
          `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
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
   * RETRY FAILED COLLECTION
   * ==========================================================================
   */

  async retry(referenceId) {
    const status =
      await this.getStatus(
        referenceId
      );

    if (
      status.data?.status ===
      "FAILED"
    ) {
      await this.recordAudit(
        "COLLECTION_RETRY_REQUESTED",
        { referenceId }
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
        "Transaction not eligible for retry",
    };
  }

  /**
   * ==========================================================================
   * HEALTH CHECK
   * ==========================================================================
   */

  async healthCheck() {
    const auth =
      await authService.healthCheck();

    return {
      provider: "MTN_MOMO",
      service: "COLLECTIONS",
      healthy: auth.healthy,
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
      service: "COLLECTIONS",
      timestamp:
        new Date().toISOString(),
    };
  }
}

module.exports =
  new MTNCollectionsService();