// backend/services/airtel/webhooks.js
/**
 * ============================================================================
 * AIRTEL MONEY WEBHOOK SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Callback Validation
 *  - Signature Verification
 *  - HMAC Validation
 *  - Idempotency Protection
 *  - Replay Protection
 *  - Transaction Updates
 *  - Settlement Triggering
 *  - Audit Logging
 *  - Event Persistence
 *
 * ============================================================================
 */

const crypto = require("crypto");

let logger;
let Transaction;
let AuditLog;
let WebhookEvent;
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
  AuditLog = require("../../models/AuditLog");
} catch {
  AuditLog = null;
}

try {
  WebhookEvent = require("../../models/WebhookEvent");
} catch {
  WebhookEvent = null;
}

try {
  settlementService = require("../../modules/mobileMoneySettlementService");
} catch {
  settlementService = null;
}

class AirtelWebhookService {
  constructor() {
    this.provider = "AIRTEL_MONEY";

    this.webhookSecret =
      process.env.AIRTEL_WEBHOOK_SECRET ||
      process.env.AIRTEL_CALLBACK_SECRET ||
      "";

    this.allowedClockSkew =
      Number(
        process.env.WEBHOOK_CLOCK_SKEW_MS ||
          300000
      ); // 5 minutes

    this.metrics = {
      received: 0,
      processed: 0,
      duplicates: 0,
      invalidSignatures: 0,
      failures: 0,
    };
  }

  /**
   * ==========================================================================
   * AUDIT LOGGING
   * ==========================================================================
   */

  async recordAudit(action, payload = {}) {
    try {
      const record = {
        provider: this.provider,
        action,
        payload,
        timestamp: new Date(),
      };

      if (AuditLog?.create) {
        await AuditLog.create(record);
      }

      logger.info(
        `[AIRTEL WEBHOOK] ${action}`,
        payload
      );
    } catch (error) {
      logger.error(
        "[AIRTEL WEBHOOK] Audit Error",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * EVENT STORAGE
   * ==========================================================================
   */

  async storeWebhookEvent(event) {
    try {
      if (!WebhookEvent?.create) {
        return null;
      }

      return WebhookEvent.create(event);
    } catch (error) {
      logger.error(
        "[AIRTEL WEBHOOK] Event Storage Error",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * SIGNATURE VALIDATION
   * ==========================================================================
   */

  generateSignature(rawBody) {
    return crypto
      .createHmac(
        "sha256",
        this.webhookSecret
      )
      .update(rawBody)
      .digest("hex");
  }

  validateSignature({
    rawBody,
    signature,
  }) {
    if (!this.webhookSecret) {
      logger.warn(
        "[AIRTEL WEBHOOK] Secret not configured"
      );
      return true;
    }

    if (!signature) {
      return false;
    }

    const expected =
      this.generateSignature(rawBody);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }

  /**
   * ==========================================================================
   * REPLAY PROTECTION
   * ==========================================================================
   */

  validateTimestamp(timestamp) {
    if (!timestamp) {
      return true;
    }

    const eventTime =
      new Date(timestamp).getTime();

    const now = Date.now();

    return (
      Math.abs(now - eventTime) <=
      this.allowedClockSkew
    );
  }

  /**
   * ==========================================================================
   * IDEMPOTENCY
   * ==========================================================================
   */

  async isDuplicateEvent(eventId) {
    if (!eventId) {
      return false;
    }

    if (!WebhookEvent?.findOne) {
      return false;
    }

    const existing =
      await WebhookEvent.findOne({
        eventId,
      });

    return !!existing;
  }

  /**
   * ==========================================================================
   * STATUS MAPPING
   * ==========================================================================
   */

  normalizeStatus(status) {
    const value =
      String(status || "")
        .trim()
        .toUpperCase();

    const mappings = {
      SUCCESS: "SUCCESS",
      SUCCESSFUL: "SUCCESS",
      COMPLETED: "SUCCESS",

      FAILED: "FAILED",
      REJECTED: "FAILED",
      ERROR: "FAILED",

      PENDING: "PENDING",
      PROCESSING: "PENDING",

      CANCELLED: "CANCELLED",
      EXPIRED: "EXPIRED",
    };

    return (
      mappings[value] || value
    );
  }

  /**
   * ==========================================================================
   * TRANSACTION UPDATE
   * ==========================================================================
   */

  async updateTransaction(
    reference,
    webhookData
  ) {
    if (
      !Transaction?.findOneAndUpdate
    ) {
      return null;
    }

    const normalizedStatus =
      this.normalizeStatus(
        webhookData.status
      );

    return Transaction.findOneAndUpdate(
      {
        $or: [
          { reference },
          {
            externalReference:
              reference,
          },
          {
            providerReference:
              reference,
          },
        ],
      },
      {
        providerStatus:
          normalizedStatus,
        status:
          normalizedStatus,
        webhookReceivedAt:
          new Date(),
        webhookPayload:
          webhookData,
        updatedAt:
          new Date(),
      },
      {
        new: true,
      }
    );
  }

  /**
   * ==========================================================================
   * SETTLEMENT POSTING
   * ==========================================================================
   */

  async processSettlement(
    transaction
  ) {
    try {
      if (
        !transaction ||
        !settlementService
      ) {
        return;
      }

      if (
        typeof settlementService.processTransaction ===
        "function"
      ) {
        await settlementService.processTransaction(
          transaction
        );
      }
    } catch (error) {
      logger.error(
        "[AIRTEL WEBHOOK] Settlement Error",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * PAYLOAD EXTRACTION
   * ==========================================================================
   */

  extractReference(payload) {
    return (
      payload.reference ||
      payload.transactionId ||
      payload.externalId ||
      payload.providerReference ||
      payload.id
    );
  }

  extractEventId(payload) {
    return (
      payload.eventId ||
      payload.notificationId ||
      payload.callbackId ||
      payload.id
    );
  }

  /**
   * ==========================================================================
   * WEBHOOK PROCESSING
   * ==========================================================================
   */

  async processWebhook({
    payload,
    rawBody,
    signature,
    sourceIP,
  }) {
    this.metrics.received++;

    const eventId =
      this.extractEventId(
        payload
      );

    try {
      await this.recordAudit(
        "WEBHOOK_RECEIVED",
        {
          sourceIP,
          eventId,
        }
      );

      /**
       * Signature Validation
       */

      const validSignature =
        this.validateSignature({
          rawBody,
          signature,
        });

      if (!validSignature) {
        this.metrics.invalidSignatures++;

        throw new Error(
          "Invalid webhook signature"
        );
      }

      /**
       * Replay Protection
       */

      const timestamp =
        payload.timestamp ||
        payload.eventTime;

      if (
        !this.validateTimestamp(
          timestamp
        )
      ) {
        throw new Error(
          "Webhook timestamp validation failed"
        );
      }

      /**
       * Idempotency Check
       */

      const duplicate =
        await this.isDuplicateEvent(
          eventId
        );

      if (duplicate) {
        this.metrics.duplicates++;

        return {
          success: true,
          duplicate: true,
          eventId,
        };
      }

      /**
       * Persist Event
       */

      await this.storeWebhookEvent({
        provider: this.provider,
        eventId,
        payload,
        receivedAt:
          new Date(),
      });

      /**
       * Update Transaction
       */

      const reference =
        this.extractReference(
          payload
        );

      const transaction =
        await this.updateTransaction(
          reference,
          payload
        );

      /**
       * Settlement Posting
       */

      if (
        transaction &&
        transaction.status ===
          "SUCCESS"
      ) {
        await this.processSettlement(
          transaction
        );
      }

      this.metrics.processed++;

      await this.recordAudit(
        "WEBHOOK_PROCESSED",
        {
          eventId,
          reference,
          status:
            transaction?.status,
        }
      );

      return {
        success: true,
        provider: this.provider,
        eventId,
        reference,
        status:
          transaction?.status ||
          "UPDATED",
        processedAt:
          new Date().toISOString(),
      };
    } catch (error) {
      this.metrics.failures++;

      await this.recordAudit(
        "WEBHOOK_FAILED",
        {
          eventId,
          error: error.message,
        }
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * HEALTH CHECK
   * ==========================================================================
   */

  healthCheck() {
    return {
      service:
        "AIRTEL_WEBHOOKS",
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
  new AirtelWebhookService();