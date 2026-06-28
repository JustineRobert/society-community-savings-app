'use strict';

/**
 * ============================================================
 * Tenant Billing Service
 * ============================================================
 * Production-grade SaaS Billing Engine
 * ============================================================
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class TenantBillingService extends EventEmitter {
  constructor({
    logger,
    db,
    cache,
    paymentGateway,
    queueService,
    auditService,
    metricsService,
    notificationService,
    config = {},
  }) {
    super();

    this.logger = logger;
    this.db = db;
    this.cache = cache;
    this.paymentGateway = paymentGateway;
    this.queueService = queueService;
    this.auditService = auditService;
    this.metricsService = metricsService;
    this.notificationService = notificationService;

    this.config = {
      invoicePrefix: 'INV',
      gracePeriodDays: 7,
      retryAttempts: 3,
      retryDelayHours: 24,
      defaultCurrency: 'USD',
      ...config,
    };
  }

  /**
   * ============================================================
   * Plans
   * ============================================================
   */

  async createPlan(payload) {
    try {
      const plan = {
        id: crypto.randomUUID(),
        name: payload.name,
        code: payload.code,
        price: payload.price,
        currency:
          payload.currency || this.config.defaultCurrency,
        billingCycle:
          payload.billingCycle || 'monthly',
        trialDays: payload.trialDays || 0,
        features: payload.features || [],
        limits: payload.limits || {},
        active: true,
        metadata: payload.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.billingPlans.create(plan);

      this.logger.info(
        `Billing plan created: ${plan.code}`
      );

      return plan;
    } catch (error) {
      this.logger.error(
        'Failed to create billing plan',
        error
      );
      throw error;
    }
  }

  async updatePlan(planId, updates = {}) {
    try {
      const plan =
        await this.db.billingPlans.findById(planId);

      if (!plan) {
        throw new Error('Billing plan not found');
      }

      const updated = {
        ...plan,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db.billingPlans.update(
        planId,
        updated
      );

      return updated;
    } catch (error) {
      this.logger.error(
        'Failed to update plan',
        error
      );
      throw error;
    }
  }

  async getPlan(planId) {
    return this.db.billingPlans.findById(planId);
  }

  async listPlans(filters = {}) {
    return this.db.billingPlans.find(filters);
  }

  /**
   * ============================================================
   * Tenant Subscription Management
   * ============================================================
   */

  async subscribeTenant({
    tenantId,
    planId,
    trial = true,
    metadata = {},
  }) {
    try {
      const plan =
        await this.db.billingPlans.findById(planId);

      if (!plan) {
        throw new Error('Billing plan not found');
      }

      const now = new Date();

      const subscription = {
        id: crypto.randomUUID(),
        tenantId,
        planId,
        status: trial && plan.trialDays
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
        metadata,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.tenantSubscriptions.create(
        subscription
      );

      await this.audit(
        tenantId,
        'TENANT_SUBSCRIBED',
        subscription
      );

      this.emit(
        'tenant.subscription.created',
        subscription
      );

      return subscription;
    } catch (error) {
      this.logger.error(
        'Failed to subscribe tenant',
        error
      );
      throw error;
    }
  }

  async changePlan({
    tenantId,
    newPlanId,
  }) {
    try {
      const subscription =
        await this.getActiveSubscription(
          tenantId
        );

      if (!subscription) {
        throw new Error(
          'Subscription not found'
        );
      }

      subscription.planId = newPlanId;
      subscription.updatedAt = new Date();

      await this.db.tenantSubscriptions.update(
        subscription.id,
        subscription
      );

      await this.audit(
        tenantId,
        'SUBSCRIPTION_PLAN_CHANGED',
        subscription
      );

      return subscription;
    } catch (error) {
      this.logger.error(
        'Failed to change plan',
        error
      );
      throw error;
    }
  }

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
        'Subscription not found'
      );
    }

    subscription.cancelAtPeriodEnd =
      !immediate;

    subscription.status = immediate
      ? 'cancelled'
      : 'active';

    subscription.cancelledAt = immediate
      ? new Date()
      : null;

    subscription.updatedAt = new Date();

    await this.db.tenantSubscriptions.update(
      subscription.id,
      subscription
    );

    await this.audit(
      tenantId,
      'SUBSCRIPTION_CANCELLED',
      subscription
    );

    return subscription;
  }

  async getActiveSubscription(tenantId) {
    return this.db.tenantSubscriptions.findOne({
      tenantId,
      status: {
        $in: ['active', 'trialing'],
      },
    });
  }

  /**
   * ============================================================
   * Invoice Management
   * ============================================================
   */

  async generateInvoice(tenantId) {
    const subscription =
      await this.getActiveSubscription(
        tenantId
      );

    if (!subscription) {
      throw new Error(
        'No active subscription'
      );
    }

    const plan =
      await this.db.billingPlans.findById(
        subscription.planId
      );

    const invoice = {
      id: crypto.randomUUID(),
      invoiceNumber:
        this.generateInvoiceNumber(),
      tenantId,
      subscriptionId: subscription.id,
      currency: plan.currency,
      amount: plan.price,
      subtotal: plan.price,
      tax: 0,
      total: plan.price,
      status: 'pending',
      dueDate: subscription.currentPeriodEnd,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.invoices.create(invoice);

    await this.audit(
      tenantId,
      'INVOICE_GENERATED',
      invoice
    );

    return invoice;
  }

  async payInvoice(
    invoiceId,
    paymentMethodId
  ) {
    const invoice =
      await this.db.invoices.findById(
        invoiceId
      );

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'paid') {
      return invoice;
    }

    try {
      const payment =
        await this.paymentGateway.charge({
          amount: invoice.total,
          currency: invoice.currency,
          paymentMethodId,
          invoiceId,
        });

      invoice.status = 'paid';
      invoice.paymentId = payment.id;
      invoice.paidAt = new Date();

      await this.db.invoices.update(
        invoice.id,
        invoice
      );

      await this.audit(
        invoice.tenantId,
        'INVOICE_PAID',
        invoice
      );

      this.emit(
        'invoice.paid',
        invoice
      );

      return invoice;
    } catch (error) {
      invoice.status = 'failed';

      await this.db.invoices.update(
        invoice.id,
        invoice
      );

      throw error;
    }
  }

  /**
   * ============================================================
   * Usage Billing
   * ============================================================
   */

  async recordUsage({
    tenantId,
    metric,
    quantity,
  }) {
    const usage = {
      id: crypto.randomUUID(),
      tenantId,
      metric,
      quantity,
      timestamp: new Date(),
    };

    await this.db.usageRecords.create(
      usage
    );

    return usage;
  }

  async getUsage(
    tenantId,
    startDate,
    endDate
  ) {
    return this.db.usageRecords.find({
      tenantId,
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    });
  }

  /**
   * ============================================================
   * Overdue Processing
   * ============================================================
   */

  async processOverdueInvoices() {
    const overdue =
      await this.db.invoices.find({
        status: 'pending',
        dueDate: {
          $lt: new Date(),
        },
      });

    for (const invoice of overdue) {
      await this.handleOverdueInvoice(
        invoice
      );
    }
  }

  async handleOverdueInvoice(invoice) {
    try {
      invoice.status = 'overdue';

      await this.db.invoices.update(
        invoice.id,
        invoice
      );

      await this.notificationService.send({
        tenantId: invoice.tenantId,
        type: 'billing_overdue',
        data: invoice,
      });

      await this.queueService.enqueue(
        'billing-retry',
        {
          invoiceId: invoice.id,
        }
      );
    } catch (error) {
      this.logger.error(
        'Failed processing overdue invoice',
        error
      );
    }
  }

  /**
   * ============================================================
   * Tenant Suspension
   * ============================================================
   */

  async suspendTenant(
    tenantId,
    reason
  ) {
    await this.db.tenants.update(
      tenantId,
      {
        status: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: reason,
      }
    );

    await this.audit(
      tenantId,
      'TENANT_SUSPENDED',
      {
        reason,
      }
    );
  }

  async reactivateTenant(
    tenantId
  ) {
    await this.db.tenants.update(
      tenantId,
      {
        status: 'active',
        suspendedAt: null,
        suspensionReason: null,
      }
    );

    await this.audit(
      tenantId,
      'TENANT_REACTIVATED'
    );
  }

  /**
   * ============================================================
   * Billing Cycle Processing
   * ============================================================
   */

  async processBillingCycle() {
    const subscriptions =
      await this.db.tenantSubscriptions.find({
        status: 'active',
        currentPeriodEnd: {
          $lte: new Date(),
        },
      });

    for (const subscription of subscriptions) {
      try {
        await this.generateInvoice(
          subscription.tenantId
        );

        subscription.currentPeriodStart =
          subscription.currentPeriodEnd;

        const plan =
          await this.db.billingPlans.findById(
            subscription.planId
          );

        subscription.currentPeriodEnd =
          this.calculateNextBillingDate(
            subscription.currentPeriodEnd,
            plan.billingCycle
          );

        await this.db.tenantSubscriptions.update(
          subscription.id,
          subscription
        );
      } catch (error) {
        this.logger.error(
          `Billing cycle failed for tenant ${subscription.tenantId}`,
          error
        );
      }
    }
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getBillingMetrics() {
    const [
      subscriptions,
      invoices,
      overdue,
    ] = await Promise.all([
      this.db.tenantSubscriptions.count({}),
      this.db.invoices.count({}),
      this.db.invoices.count({
        status: 'overdue',
      }),
    ]);

    return {
      subscriptions,
      invoices,
      overdue,
    };
  }

  /**
   * ============================================================
   * Helpers
   * ============================================================
   */

  calculateNextBillingDate(
    startDate,
    cycle
  ) {
    const date = new Date(startDate);

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

      case 'monthly':
      default:
        date.setMonth(
          date.getMonth() + 1
        );
        break;
    }

    return date;
  }

  generateInvoiceNumber() {
    return `${this.config.invoicePrefix}-${Date.now()}-${Math.floor(
      Math.random() * 10000
    )}`;
  }

  async audit(
    tenantId,
    action,
    payload = {}
  ) {
    if (!this.auditService) return;

    try {
      await this.auditService.log({
        tenantId,
        action,
        payload,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        'Audit logging failed',
        error
      );
    }
  }
}

module.exports = TenantBillingService;