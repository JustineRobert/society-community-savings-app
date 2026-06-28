// backend/modules/notificationService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class NotificationService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    auditService,
    metricsService,

    emailProvider,
    smsProvider,
    pushProvider,
    webhookProvider,

    templateService,
    localizationService,

    config = {},
  }) {
    super();

    this.db = db;
    this.logger = logger;
    this.cache = cache;
    this.queueService = queueService;
    this.auditService = auditService;
    this.metricsService = metricsService;

    this.emailProvider =
      emailProvider;
    this.smsProvider =
      smsProvider;
    this.pushProvider =
      pushProvider;
    this.webhookProvider =
      webhookProvider;

    this.templateService =
      templateService;
    this.localizationService =
      localizationService;

    this.config = {
      maxRetries: 5,
      retryDelayMs: 30000,
      cacheTtl: 300,
      enableAudit: true,
      defaultLanguage: 'en',
      ...config,
    };
  }

  /**
   * ============================================================
   * Public API
   * ============================================================
   */

  async send(payload) {
    const notification =
      await this.createNotification(
        payload
      );

    await this.queueService.enqueue(
      'notification-send',
      {
        notificationId:
          notification.id,
      }
    );

    return notification;
  }

  async sendImmediate(
    payload
  ) {
    const notification =
      await this.createNotification(
        payload
      );

    await this.processNotification(
      notification.id
    );

    return notification;
  }

  async schedule(
    payload,
    sendAt
  ) {
    const notification =
      await this.createNotification({
        ...payload,
        scheduledAt: sendAt,
      });

    await this.queueService.enqueue(
      'notification-scheduled',
      {
        notificationId:
          notification.id,
      },
      {
        delay:
          sendAt.getTime() -
          Date.now(),
      }
    );

    return notification;
  }

  /**
   * ============================================================
   * Notification Creation
   * ============================================================
   */

  async createNotification(
    payload
  ) {
    const notification = {
      id: crypto.randomUUID(),
      tenantId:
        payload.tenantId,
      customerId:
        payload.customerId,
      userId:
        payload.userId,

      channel:
        payload.channel ||
        'in_app',

      type:
        payload.type,

      template:
        payload.template,

      subject:
        payload.subject,

      message:
        payload.message,

      metadata:
        payload.metadata || {},

      recipient:
        payload.recipient || {},

      status: 'pending',

      retries: 0,

      language:
        payload.language ||
        this.config
          .defaultLanguage,

      scheduledAt:
        payload.scheduledAt,

      createdAt:
        new Date(),

      updatedAt:
        new Date(),
    };

    await this.db.notifications.create(
      notification
    );

    return notification;
  }

  /**
   * ============================================================
   * Processing
   * ============================================================
   */

  async processNotification(
    notificationId
  ) {
    const notification =
      await this.db.notifications.findById(
        notificationId
      );

    if (!notification) {
      throw new Error(
        'Notification not found.'
      );
    }

    try {
      notification.status =
        'processing';

      await this.db.notifications.update(
        notification.id,
        notification
      );

      const message =
        await this.buildMessage(
          notification
        );

      switch (
        notification.channel
      ) {
        case 'email':
          await this.sendEmail(
            notification,
            message
          );
          break;

        case 'sms':
          await this.sendSMS(
            notification,
            message
          );
          break;

        case 'push':
          await this.sendPush(
            notification,
            message
          );
          break;

        case 'webhook':
          await this.sendWebhook(
            notification,
            message
          );
          break;

        case 'in_app':
        default:
          await this.sendInApp(
            notification,
            message
          );
      }

      notification.status =
        'sent';
      notification.sentAt =
        new Date();

      await this.db.notifications.update(
        notification.id,
        notification
      );

      await this.audit(
        notification,
        'NOTIFICATION_SENT'
      );

      this.emit(
        'notification.sent',
        notification
      );

      return notification;
    } catch (error) {
      return this.handleFailure(
        notification,
        error
      );
    }
  }

  /**
   * ============================================================
   * Build Message
   * ============================================================
   */

  async buildMessage(
    notification
  ) {
    let message =
      notification.message;

    if (
      notification.template &&
      this.templateService
    ) {
      message =
        await this.templateService.render(
          notification.template,
          notification.metadata
        );
    }

    if (
      this.localizationService
    ) {
      message =
        await this.localizationService.translate(
          message,
          notification.language
        );
    }

    return message;
  }

  /**
   * ============================================================
   * Channels
   * ============================================================
   */

  async sendEmail(
    notification,
    message
  ) {
    if (!this.emailProvider) {
      throw new Error(
        'Email provider unavailable.'
      );
    }

    await this.emailProvider.send({
      to:
        notification.recipient
          .email,
      subject:
        notification.subject,
      message,
    });
  }

  async sendSMS(
    notification,
    message
  ) {
    if (!this.smsProvider) {
      throw new Error(
        'SMS provider unavailable.'
      );
    }

    await this.smsProvider.send({
      to:
        notification.recipient
          .phone,
      message,
    });
  }

  async sendPush(
    notification,
    message
  ) {
    if (!this.pushProvider) {
      throw new Error(
        'Push provider unavailable.'
      );
    }

    await this.pushProvider.send({
      token:
        notification.recipient
          .deviceToken,
      title:
        notification.subject,
      body: message,
    });
  }

  async sendWebhook(
    notification,
    message
  ) {
    if (
      !this.webhookProvider
    ) {
      throw new Error(
        'Webhook provider unavailable.'
      );
    }

    await this.webhookProvider.send({
      url:
        notification.recipient.url,
      payload: {
        message,
        metadata:
          notification.metadata,
      },
    });
  }

  async sendInApp(
    notification,
    message
  ) {
    notification.inAppPayload = {
      title:
        notification.subject,
      message,
    };

    await this.db.notifications.update(
      notification.id,
      notification
    );
  }

  /**
   * ============================================================
   * Failure Handling
   * ============================================================
   */

  async handleFailure(
    notification,
    error
  ) {
    this.logger.error(
      'Notification failed',
      error
    );

    notification.retries += 1;
    notification.lastError =
      error.message;

    if (
      notification.retries >=
      this.config.maxRetries
    ) {
      notification.status =
        'failed';

      await this.db.notifications.update(
        notification.id,
        notification
      );

      await this.queueService.enqueue(
        'notification-dead-letter',
        {
          notificationId:
            notification.id,
        }
      );

      this.emit(
        'notification.failed',
        notification
      );

      return notification;
    }

    notification.status =
      'retry';

    await this.db.notifications.update(
      notification.id,
      notification
    );

    await this.queueService.enqueue(
      'notification-send',
      {
        notificationId:
          notification.id,
      },
      {
        delay:
          this.config
            .retryDelayMs,
      }
    );

    return notification;
  }

  /**
   * ============================================================
   * Preferences
   * ============================================================
   */

  async getPreferences(
    userId
  ) {
    return this.db.notificationPreferences.findOne(
      {
        userId,
      }
    );
  }

  async updatePreferences(
    userId,
    preferences
  ) {
    return this.db.notificationPreferences.upsert(
      {
        userId,
        ...preferences,
      }
    );
  }

  /**
   * ============================================================
   * Read Receipts
   * ============================================================
   */

  async markAsRead(
    notificationId
  ) {
    const notification =
      await this.db.notifications.findById(
        notificationId
      );

    if (!notification) {
      return null;
    }

    notification.read =
      true;
    notification.readAt =
      new Date();

    await this.db.notifications.update(
      notification.id,
      notification
    );

    return notification;
  }

  /**
   * ============================================================
   * Bulk Notifications
   * ============================================================
   */

  async sendBulk(
    notifications
  ) {
    const results = [];

    for (const item of notifications) {
      try {
        const result =
          await this.send(
            item
          );

        results.push({
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          success: false,
          error:
            error.message,
        });
      }
    }

    return results;
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getMetrics() {
    const [
      sent,
      failed,
      pending,
      read,
    ] = await Promise.all([
      this.db.notifications.count({
        status: 'sent',
      }),
      this.db.notifications.count({
        status: 'failed',
      }),
      this.db.notifications.count({
        status: 'pending',
      }),
      this.db.notifications.count({
        read: true,
      }),
    ]);

    return {
      sent,
      failed,
      pending,
      read,
    };
  }

  /**
   * ============================================================
   * Audit
   * ============================================================
   */

  async audit(
    notification,
    action
  ) {
    if (
      !this.auditService ||
      !this.config.enableAudit
    ) {
      return;
    }

    try {
      await this.auditService.log({
        tenantId:
          notification.tenantId,
        customerId:
          notification.customerId,
        userId:
          notification.userId,
        action,
        payload: {
          notificationId:
            notification.id,
          channel:
            notification.channel,
          type:
            notification.type,
        },
        timestamp:
          new Date(),
      });
    } catch (error) {
      this.logger.error(
        'Notification audit failed',
        error
      );
    }
  }
}

module.exports =
  NotificationService;