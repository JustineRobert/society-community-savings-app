// backend/services/mtn/webhooks.js
/**
 * ============================================================================
 * MTN MOMO WEBHOOK SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - Callback Validation
 *  - Signature Verification
 *  - IP Allowlisting
 *  - Replay Protection
 *  - Idempotency Protection
 *  - Status Updates
 *  - Settlement Triggers
 *  - Audit Logging
 *  * Reconciliation Hooks
 * ============================================================================
 */

const crypto = require("crypto");

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

class MTNWebhookService {
  constructor() {
    this.webhookSecret =
      process.env.MTN_WEBHOOK_SECRET || "";

    this.replayWindowMs =
      Number(
        process.env.MTN_WEBHOOK_REPLAY_WINDOW_MS
      ) || 300000;

    /**
     * In-memory replay cache.
     * Production clusters should replace
     * with Redis.
     */
    this.processedEvents =
      new Map();

    /**
     * Optional MTN source IP allowlist.
     */
    this.allowedIPs = (
      process.env.MTN_WEBHOOK_IPS || ""
    )
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
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
        typeof auditService.record ===
          "function"
      ) {
        await auditService.record(
          entry
        );
      }

      logger.info(
        `[MTN WEBHOOK] ${action}`,
        entry
      );

      return entry;
    } catch (error) {
      logger.error(
        "[MTN WEBHOOK] Audit Failure",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * SOURCE VALIDATION
   * ==========================================================================
   */

  validateSourceIP(ip) {
    if (
      this.allowedIPs.length === 0
    ) {
      return true;
    }

    return this.allowedIPs.includes(
      ip
    );
  }

  /**
   * ==========================================================================
   * SIGNATURE VALIDATION
   * ==========================================================================
   */

  validateSignature(
    rawBody,
    signature
  ) {
    if (!this.webhookSecret) {
      return true;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          this.webhookSecret
        )
        .update(rawBody)
        .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature || "")
    );
  }

  /**
   * ==========================================================================
   * CALLBACK VALIDATION
   * ==========================================================================
   */

  validatePayload(payload) {
    if (!payload) {
      throw new Error(
        "Webhook payload missing"
      );
    }

    if (
      !payload.externalId &&
      !payload.referenceId
    ) {
      throw new Error(
        "Missing transaction reference"
      );
    }

    return true;
  }

  /**
   * ==========================================================================
   * REPLAY PROTECTION
   * ==========================================================================
   */

  isReplay(eventId) {
    const now = Date.now();

    for (const [
      key,
      timestamp,
    ] of this.processedEvents) {
      if (
        now - timestamp >
        this.replayWindowMs
      ) {
        this.processedEvents.delete(
          key
        );
      }
    }

    return this.processedEvents.has(
      eventId
    );
  }

  markProcessed(eventId) {
    this.processedEvents.set(
      eventId,
      Date.now()
    );
  }

  /**
   * ==========================================================================
   * IDEMPOTENCY
   * ==========================================================================
   */

  async checkIdempotency(
    reference
  ) {
    if (!Transaction) {
      return false;
    }

    const transaction =
      await Transaction.findOne({
        reference,
        webhookProcessed: true,
      });

    return !!transaction;
  }

  /**
   * ==========================================================================
   * TRANSACTION LOOKUP
   * ==========================================================================
   */

  async findTransaction(
    reference
  ) {
    if (!Transaction) {
      return null;
    }

    return Transaction.findOne({
      $or: [
        {
          reference,
        },
        {
          providerReference:
            reference,
        },
        {
          externalId:
            reference,
        },
      ],
    });
  }

  /**
   * ==========================================================================
   * STATUS MAPPING
   * ==========================================================================
   */

  mapProviderStatus(
    providerStatus
  ) {
    const status =
      String(
        providerStatus || ""
      ).toUpperCase();

    switch (status) {
      case "SUCCESSFUL":
      case "SUCCESS":
      case "COMPLETED":
        return "COMPLETED";

      case "FAILED":
      case "REJECTED":
      case "CANCELLED":
        return "FAILED";

      case "PENDING":
      case "INITIATED":
        return "PENDING";

      default:
        return "UNKNOWN";
    }
  }

  /**
   * ==========================================================================
   * UPDATE TRANSACTION
   * ==========================================================================
   */

  async updateTransaction(
    transaction,
    payload
  ) {
    if (!transaction) {
      return null;
    }

    transaction.providerStatus =
      payload.status;

    transaction.status =
      this.mapProviderStatus(
        payload.status
      );

    transaction.webhookProcessed =
      true;

    transaction.webhookReceivedAt =
      new Date();

    transaction.providerPayload =
      payload;

    if (
      typeof transaction.save ===
      "function"
    ) {
      await transaction.save();
    }

    return transaction;
  }

  /**
   * ==========================================================================
   * SETTLEMENT PROCESSING
   * ==========================================================================
   */

  async processSettlement(
    transaction
  ) {
    if (
      !settlementService ||
      !transaction
    ) {
      return;
    }

    try {
      if (
        transaction.status !==
        "COMPLETED"
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
        "Settlement processing failed",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * STATUS UPDATE HANDLER
   * ==========================================================================
   */

  async processStatusUpdate(
    payload
  ) {
    const reference =
      payload.referenceId ||
      payload.externalId;

    const transaction =
      await this.findTransaction(
        reference
      );

    if (!transaction) {
      await this.recordAudit(
        "TRANSACTION_NOT_FOUND",
        {
          reference,
        }
      );

      return {
        success: false,
        reason:
          "Transaction not found",
      };
    }

    const updated =
      await this.updateTransaction(
        transaction,
        payload
      );

    await this.processSettlement(
      updated
    );

    await this.recordAudit(
      "STATUS_UPDATED",
      {
        reference,
        status:
          updated.status,
      }
    );

    return {
      success: true,
      transactionId:
        updated._id,
      status:
        updated.status,
    };
  }

  /**
   * ==========================================================================
   * MAIN WEBHOOK HANDLER
   * ==========================================================================
   */

  async processWebhook({
    payload,
    rawBody,
    signature,
    sourceIP,
  }) {
    try {
      if (
        !this.validateSourceIP(
          sourceIP
        )
      ) {
        throw new Error(
          "Unauthorized source IP"
        );
      }

      if (
        !this.validateSignature(
          rawBody,
          signature
        )
      ) {
        throw new Error(
          "Invalid signature"
        );
      }

      this.validatePayload(
        payload
      );

      const eventId =
        payload.eventId ||
        payload.referenceId ||
        payload.externalId;

      if (
        this.isReplay(eventId)
      ) {
        return {
          success: true,
          duplicate: true,
        };
      }

      this.markProcessed(
        eventId
      );

      const alreadyProcessed =
        await this.checkIdempotency(
          payload.referenceId ||
            payload.externalId
        );

      if (
        alreadyProcessed
      ) {
        return {
          success: true,
          idempotent: true,
        };
      }

      const result =
        await this.processStatusUpdate(
          payload
        );

      await this.recordAudit(
        "WEBHOOK_PROCESSED",
        {
          eventId,
          result,
        }
      );

      return result;
    } catch (error) {
      await this.recordAudit(
        "WEBHOOK_FAILED",
        {
          error:
            error.message,
          payload,
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
      provider: "MTN_MOMO",
      service: "WEBHOOKS",
      replayCacheSize:
        this.processedEvents.size,
      replayWindowMs:
        this.replayWindowMs,
      timestamp:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * CACHE MAINTENANCE
   * ==========================================================================
   */

  clearReplayCache() {
    this.processedEvents.clear();

    return {
      success: true,
      timestamp:
        new Date().toISOString(),
    };
  }
}

module.exports =
  new MTNWebhookService();