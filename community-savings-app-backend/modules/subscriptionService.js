// backend/modules/subscriptionService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class SubscriptionService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    auditService,
    metricsService,
    tenantBillingService,
    notificationService,
    featureFlagService,
    config = {},
  }) {
    super();

    this.db = db;
    this.logger = logger;
    this.cache = cache;
    this.queueService = queueService;
    this.auditService = auditService;
    this.metricsService = metricsService;
    this.tenantBillingService = tenantBillingService;
    this.notificationService = notificationService;
    this.featureFlagService = featureFlagService;

    this.config = {
      trialDays: 14,
      gracePeriodDays: 7,
      cacheTtl: 300,
      ...config,
    };
  }

  /**
   * ============================================================
   * Subscription Creation
   * ============================================================
   */

  async createSubscription({
    tenantId,
    planId,
    trial = true,
    metadata = {},
  }) {
    try {
      const existing =
        await this.getActiveSubscription(tenantId);

      if (existing) {
        throw new Error(
          'Tenant already has an active subscription.'
        );
      }

      const plan =
        await this.db.billingPlans.findById(planId);

      if (!plan) {
        throw new Error('Plan not found.');
      }

      const now = new Date();

      const subscription = {
        id: crypto.randomUUID(),
        tenantId,
        planId,
        status:
          trial && plan.trialDays
            ? 'trialing'
            : 'active',
        startedAt: now,
        trialEndsAt:
          trial && plan.trialDays
            ? new Date(
                now.getTime() +
                  plan.trialDays *
                    24 *
                    60 *
                    60 *
                    1000
              )
            : null,
        currentPeriodStart: now,
        currentPeriodEnd:
          this.calculateNextBillingDate(
            now,
            plan.billingCycle
          ),
        cancelAtPeriodEnd: false,
        metadata,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.subscriptions.create(
        subscription
      );

      await this.invalidateCache(tenantId);

      await this.audit(
        tenantId,
        'SUBSCRIPTION_CREATED',
        subscription
      );

      this.emit(
        'subscription.created',
        subscription
      );

      return subscription;
    } catch (error) {
      this.logger.error(
        'Create subscription failed.',
        error
      );
      throw error;
    }
  }

  /**
   * ============================================================
   * Retrieval
   * ============================================================
   */

  async getSubscription(subscriptionId) {
    return this.db.subscriptions.findById(
      subscriptionId
    );
  }

  async getActiveSubscription(tenantId) {
    const cacheKey =
      `subscription:${tenantId}`;

    if (this.cache) {
      const cached =
        await this.cache.get(cacheKey);

      if (cached) {
        return cached;
      }
    }

    const subscription =
      await this.db.subscriptions.findOne({
        tenantId,
        status: {
          $in: [
            'active',
            'trialing',
            'past_due',
            'grace',
          ],
        },
      });

    if (
      subscription &&
      this.cache
    ) {
      await this.cache.set(
        cacheKey,
        subscription,
        this.config.cacheTtl
      );
    }

    return subscription;
  }

  /**
   * ============================================================
   * Plan Changes
   * ============================================================
   */

  async upgradePlan(
    tenantId,
    newPlanId
  ) {
    return this.changePlan(
      tenantId,
      newPlanId,
      'upgrade'
    );
  }

  async downgradePlan(
    tenantId,
    newPlanId
  ) {
    return this.changePlan(
      tenantId,
      newPlanId,
      'downgrade'
    );
  }

  async changePlan(
    tenantId,
    newPlanId,
    changeType
  ) {
    const subscription =
      await this.getActiveSubscription(
        tenantId
      );

    if (!subscription) {
      throw new Error(
        'Subscription not found.'
      );
    }

    const oldPlan =
      await this.db.billingPlans.findById(
        subscription.planId
      );

    const newPlan =
      await this.db.billingPlans.findById(
        newPlanId
      );

    if (!newPlan) {
      throw new Error(
        'Target plan not found.'
      );
    }

    const proration =
      this.calculateProration(
        oldPlan,
        newPlan,
        subscription
      );

    subscription.planId = newPlanId;
    subscription.updatedAt = new Date();

    await this.db.subscriptions.update(
      subscription.id,
      subscription
    );

    await this.invalidateCache(
      tenantId
    );

    await this.audit(
      tenantId,
      `PLAN_${changeType.toUpperCase()}`,
      {
        oldPlanId: oldPlan.id,
        newPlanId,
        proration,
      }
    );

    this.emit(
      'subscription.plan.changed',
      {
        tenantId,
        oldPlan,
        newPlan,
        proration,
      }
    );

    return {
      subscription,
      proration,
    };
  }

  /**
   * ============================================================
   * Cancellation
   * ============================================================
   */

  async cancelSubscription(
    tenantId,
    immediate = false
  ) {
    const subscription =
      await this.getActiveSubscription(
        tenantId
      );

    if (!subscription) {
      throw new Error(
        'Subscription not found.'
      );
    }

    if (immediate) {
      subscription.status =
        'cancelled';
      subscription.cancelledAt =
        new Date();
    } else {
      subscription.cancelAtPeriodEnd =
        true;
    }

    subscription.updatedAt =
      new Date();

    await this.db.subscriptions.update(
      subscription.id,
      subscription
    );

    await this.invalidateCache(
      tenantId
    );

    await this.audit(
      tenantId,
      'SUBSCRIPTION_CANCELLED',
      subscription
    );

    this.emit(
      'subscription.cancelled',
      subscription
    );

    return subscription;
  }

  async reactivateSubscription(
    tenantId
  ) {
    const subscription =
      await this.db.subscriptions.findOne({
        tenantId,
        status: 'cancelled',
      });

    if (!subscription) {
      throw new Error(
        'Cancelled subscription not found.'
      );
    }

    subscription.status = 'active';
    subscription.cancelledAt = null;
    subscription.cancelAtPeriodEnd =
      false;
    subscription.updatedAt =
      new Date();

    await this.db.subscriptions.update(
      subscription.id,
      subscription
    );

    await this.invalidateCache(
      tenantId
    );

    await this.audit(
      tenantId,
      'SUBSCRIPTION_REACTIVATED',
      subscription
    );

    return subscription;
  }

  /**
   * ============================================================
   * Billing Synchronization
   * ============================================================
   */

  async processRenewals() {
    const subscriptions =
      await this.db.subscriptions.find({
        status: {
          $in: ['active', 'trialing'],
        },
        currentPeriodEnd: {
          $lte: new Date(),
        },
      });

    for (const subscription of subscriptions) {
      try {
        await this.tenantBillingService.generateInvoice(
          subscription.tenantId
        );

        const plan =
          await this.db.billingPlans.findById(
            subscription.planId
          );

        subscription.currentPeriodStart =
          subscription.currentPeriodEnd;

        subscription.currentPeriodEnd =
          this.calculateNextBillingDate(
            subscription.currentPeriodEnd,
            plan.billingCycle
          );

        await this.db.subscriptions.update(
          subscription.id,
          subscription
        );

        this.emit(
          'subscription.renewed',
          subscription
        );
      } catch (error) {
        this.logger.error(
          `Renewal failed for tenant ${subscription.tenantId}`,
          error
        );
      }
    }
  }

  /**
   * ============================================================
   * Grace Period Processing
   * ============================================================
   */

  async processGracePeriods() {
    const subscriptions =
      await this.db.subscriptions.find({
        status: 'past_due',
      });

    for (const subscription of subscriptions) {
      const graceEnd =
        new Date(
          subscription.updatedAt
        );

      graceEnd.setDate(
        graceEnd.getDate() +
          this.config.gracePeriodDays
      );

      if (new Date() > graceEnd) {
        subscription.status =
          'suspended';

        await this.db.subscriptions.update(
          subscription.id,
          subscription
        );

        this.emit(
          'subscription.suspended',
          subscription
        );
      }
    }
  }

  /**
   * ============================================================
   * Usage Limits
   * ============================================================
   */

  async checkFeatureAccess(
    tenantId,
    feature
  ) {
    const subscription =
      await this.getActiveSubscription(
        tenantId
      );

    if (!subscription) {
      return false;
    }

    const plan =
      await this.db.billingPlans.findById(
        subscription.planId
      );

    return (
      plan.features?.includes(feature) ||
      false
    );
  }

  async checkUsageLimit(
    tenantId,
    metric,
    value
  ) {
    const subscription =
      await this.getActiveSubscription(
        tenantId
      );

    if (!subscription) {
      return false;
    }

    const plan =
      await this.db.billingPlans.findById(
        subscription.planId
      );

    const limit =
      plan.limits?.[metric];

    if (
      limit === undefined ||
      limit === null
    ) {
      return true;
    }

    return value <= limit;
  }

  /**
   * ============================================================
   * Webhooks
   * ============================================================
   */

  async processWebhook(payload) {
    this.logger.info(
      'Processing subscription webhook.'
    );

    await this.queueService.enqueue(
      'subscription-webhook',
      payload
    );
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getMetrics() {
    const [
      active,
      cancelled,
      suspended,
      trialing,
    ] = await Promise.all([
      this.db.subscriptions.count({
        status: 'active',
      }),
      this.db.subscriptions.count({
        status: 'cancelled',
      }),
      this.db.subscriptions.count({
        status: 'suspended',
      }),
      this.db.subscriptions.count({
        status: 'trialing',
      }),
    ]);

    return {
      active,
      cancelled,
      suspended,
      trialing,
    };
  }

  /**
   * ============================================================
   * Helpers
   * ============================================================
   */

  calculateNextBillingDate(
    start,
    cycle
  ) {
    const date = new Date(start);

    switch (cycle) {
      case 'yearly':
        date.setFullYear(
          date.getFullYear() + 1
        );
        break;

      case 'quarterly':
        date.setMonth(
          date.getMonth() + 3
        );
        break;

      case 'weekly':
        date.setDate(
          date.getDate() + 7
        );
        break;

      default:
        date.setMonth(
          date.getMonth() + 1
        );
    }

    return date;
  }

  calculateProration(
    oldPlan,
    newPlan,
    subscription
  ) {
    const total =
      subscription.currentPeriodEnd -
      subscription.currentPeriodStart;

    const remaining =
      subscription.currentPeriodEnd -
      Date.now();

    const ratio =
      remaining / total;

    return {
      credit:
        oldPlan.price * ratio,
      charge:
        newPlan.price * ratio,
      difference:
        (newPlan.price -
          oldPlan.price) *
        ratio,
    };
  }

  async invalidateCache(
    tenantId
  ) {
    if (!this.cache) {
      return;
    }

    await this.cache.del(
      `subscription:${tenantId}`
    );
  }

  async audit(
    tenantId,
    action,
    payload = {}
  ) {
    if (!this.auditService) {
      return;
    }

    try {
      await this.auditService.log({
        tenantId,
        action,
        payload,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        'Subscription audit failed.',
        error
      );
    }
  }
}

module.exports = SubscriptionService;