// backend/modules/executiveDashboardService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class ExecutiveDashboardService extends EventEmitter {
  constructor({
    db,
    cache,
    logger,
    queueService,
    auditService,
    metricsService,

    tenantBillingService,
    subscriptionService,
    customerService,
    loanAccountingService,
    savingsAccountingService,
    mobileMoneySettlementService,
    fraudDetectionService,
    amlService,
    kycService,
    riskScoringService,
    regulatoryReportingService,

    config = {},
  }) {
    super();

    this.db = db;
    this.cache = cache;
    this.logger = logger;
    this.queueService = queueService;
    this.auditService = auditService;
    this.metricsService = metricsService;

    this.tenantBillingService =
      tenantBillingService;
    this.subscriptionService =
      subscriptionService;
    this.customerService =
      customerService;
    this.loanAccountingService =
      loanAccountingService;
    this.savingsAccountingService =
      savingsAccountingService;
    this.mobileMoneySettlementService =
      mobileMoneySettlementService;
    this.fraudDetectionService =
      fraudDetectionService;
    this.amlService = amlService;
    this.kycService = kycService;
    this.riskScoringService =
      riskScoringService;
    this.regulatoryReportingService =
      regulatoryReportingService;

    this.config = {
      cacheTtl: 300,
      snapshotRetentionDays: 365,
      ...config,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Dashboard API
   |--------------------------------------------------------------------------
   */

  async getDashboard(
    tenantId,
    options = {}
  ) {
    const cacheKey =
      `dashboard:${tenantId}`;

    if (
      !options.forceRefresh &&
      this.cache
    ) {
      const cached =
        await this.cache.get(
          cacheKey
        );

      if (cached) {
        return cached;
      }
    }

    try {
      const dashboard =
        await this.buildDashboard(
          tenantId
        );

      if (this.cache) {
        await this.cache.set(
          cacheKey,
          dashboard,
          this.config.cacheTtl
        );
      }

      return dashboard;
    } catch (error) {
      this.logger.error(
        'Dashboard generation failed',
        error
      );

      throw error;
    }
  }

  /*
   |--------------------------------------------------------------------------
   | Dashboard Builder
   |--------------------------------------------------------------------------
   */

  async buildDashboard(
    tenantId
  ) {
    const [
      financial,
      customers,
      loans,
      savings,
      mobileMoney,
      fraud,
      aml,
      kyc,
      subscriptions,
      compliance,
      system,
    ] = await Promise.all([
      this.getFinancialMetrics(
        tenantId
      ),
      this.getCustomerMetrics(
        tenantId
      ),
      this.getLoanMetrics(
        tenantId
      ),
      this.getSavingsMetrics(
        tenantId
      ),
      this.getMobileMoneyMetrics(
        tenantId
      ),
      this.getFraudMetrics(
        tenantId
      ),
      this.getAMLAnalytics(
        tenantId
      ),
      this.getKYCMetrics(
        tenantId
      ),
      this.getSubscriptionMetrics(
        tenantId
      ),
      this.getComplianceMetrics(
        tenantId
      ),
      this.getSystemMetrics(
        tenantId
      ),
    ]);

    return {
      tenantId,

      generatedAt:
        new Date(),

      financial,
      customers,
      loans,
      savings,
      mobileMoney,
      fraud,
      aml,
      kyc,
      subscriptions,
      compliance,
      system,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Financial Metrics
   |--------------------------------------------------------------------------
   */

  async getFinancialMetrics(
    tenantId
  ) {
    const [
      revenue,
      expenses,
      assets,
      liabilities,
    ] = await Promise.all([
      this.db.payments.aggregate(
        [
          {
            $match: {
              tenantId,
              status: 'paid',
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$amount',
              },
            },
          },
        ]
      ),

      this.db.expenses.aggregate(
        [
          {
            $match: {
              tenantId,
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$amount',
              },
            },
          },
        ]
      ),

      this.db.accounts.aggregate(
        [
          {
            $match: {
              tenantId,
              type:
                'asset',
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$balance',
              },
            },
          },
        ]
      ),

      this.db.accounts.aggregate(
        [
          {
            $match: {
              tenantId,
              type:
                'liability',
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$balance',
              },
            },
          },
        ]
      ),
    ]);

    return {
      revenue:
        revenue[0]?.total ||
        0,
      expenses:
        expenses[0]?.total ||
        0,
      assets:
        assets[0]?.total || 0,
      liabilities:
        liabilities[0]
          ?.total || 0,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Customer Analytics
   |--------------------------------------------------------------------------
   */

  async getCustomerMetrics(
    tenantId
  ) {
    const [
      total,
      active,
      suspended,
      newCustomers,
    ] = await Promise.all([
      this.db.customers.count({
        tenantId,
      }),

      this.db.customers.count({
        tenantId,
        status:
          'active',
      }),

      this.db.customers.count({
        tenantId,
        status:
          'suspended',
      }),

      this.db.customers.count({
        tenantId,
        createdAt: {
          $gte:
            new Date(
              Date.now() -
                30 *
                  24 *
                  60 *
                  60 *
                  1000
            ),
        },
      }),
    ]);

    return {
      total,
      active,
      suspended,
      newCustomers,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Loan Analytics
   |--------------------------------------------------------------------------
   */

  async getLoanMetrics(
    tenantId
  ) {
    const [
      activeLoans,
      overdueLoans,
      totalPortfolio,
    ] = await Promise.all([
      this.db.loans.count({
        tenantId,
        status:
          'active',
      }),

      this.db.loans.count({
        tenantId,
        status:
          'overdue',
      }),

      this.db.loans.aggregate(
        [
          {
            $match: {
              tenantId,
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$balance',
              },
            },
          },
        ]
      ),
    ]);

    return {
      activeLoans,
      overdueLoans,
      totalPortfolio:
        totalPortfolio[0]
          ?.total || 0,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Savings Analytics
   |--------------------------------------------------------------------------
   */

  async getSavingsMetrics(
    tenantId
  ) {
    const [
      accounts,
      deposits,
      balances,
    ] = await Promise.all([
      this.db.savingsAccounts.count(
        {
          tenantId,
        }
      ),

      this.db.savingsTransactions.aggregate(
        [
          {
            $match: {
              tenantId,
              type:
                'deposit',
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$amount',
              },
            },
          },
        ]
      ),

      this.db.savingsAccounts.aggregate(
        [
          {
            $match: {
              tenantId,
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  '$balance',
              },
            },
          },
        ]
      ),
    ]);

    return {
      accounts,
      deposits:
        deposits[0]?.total ||
        0,
      balances:
        balances[0]?.total ||
        0,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Mobile Money Analytics
   |--------------------------------------------------------------------------
   */

  async getMobileMoneyMetrics(
    tenantId
  ) {
    const [
      settlements,
      transactions,
    ] = await Promise.all([
      this.db.mobileMoneySettlements.count(
        {
          tenantId,
        }
      ),

      this.db.mobileMoneyTransactions.count(
        {
          tenantId,
        }
      ),
    ]);

    return {
      settlements,
      transactions,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Fraud Analytics
   |--------------------------------------------------------------------------
   */

  async getFraudMetrics(
    tenantId
  ) {
    const [
      alerts,
      cases,
    ] = await Promise.all([
      this.db.fraudAlerts.count({
        tenantId,
      }),

      this.db.fraudCases.count({
        tenantId,
      }),
    ]);

    return {
      alerts,
      cases,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | AML Analytics
   |--------------------------------------------------------------------------
   */

  async getAMLAnalytics(
    tenantId
  ) {
    const [
      alerts,
      cases,
    ] = await Promise.all([
      this.db.amlAlerts.count({
        tenantId,
      }),

      this.db.amlCases.count({
        tenantId,
      }),
    ]);

    return {
      alerts,
      cases,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | KYC Analytics
   |--------------------------------------------------------------------------
   */

  async getKYCMetrics(
    tenantId
  ) {
    const [
      verified,
      pending,
      rejected,
    ] = await Promise.all([
      this.db.kycProfiles.count({
        tenantId,
        status:
          'verified',
      }),

      this.db.kycProfiles.count({
        tenantId,
        status:
          'pending',
      }),

      this.db.kycProfiles.count({
        tenantId,
        status:
          'rejected',
      }),
    ]);

    return {
      verified,
      pending,
      rejected,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Subscription Analytics
   |--------------------------------------------------------------------------
   */

  async getSubscriptionMetrics(
    tenantId
  ) {
    const subscription =
      await this.subscriptionService?.getActiveSubscription(
        tenantId
      );

    const invoices =
      await this.db.invoices.count({
        tenantId,
      });

    return {
      subscription:
        subscription || null,
      invoices,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Compliance Analytics
   |--------------------------------------------------------------------------
   */

  async getComplianceMetrics(
    tenantId
  ) {
    const reports =
      await this.db.regulatoryReports.count(
        {
          tenantId,
        }
      );

    return {
      reports,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | System Analytics
   |--------------------------------------------------------------------------
   */

  async getSystemMetrics() {
    return {
      uptime:
        process.uptime(),
      memory:
        process.memoryUsage(),
      cpu:
        process.cpuUsage(),
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Snapshots
   |--------------------------------------------------------------------------
   */

  async createSnapshot(
    tenantId
  ) {
    const dashboard =
      await this.getDashboard(
        tenantId,
        {
          forceRefresh: true,
        }
      );

    const snapshot = {
      id:
        crypto.randomUUID(),
      tenantId,
      dashboard,
      createdAt:
        new Date(),
    };

    await this.db.dashboardSnapshots.create(
      snapshot
    );

    return snapshot;
  }

  async getSnapshots(
    tenantId,
    limit = 30
  ) {
    return this.db.dashboardSnapshots.find(
      { tenantId },
      {
        sort: {
          createdAt: -1,
        },
        limit,
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Refresh
   |--------------------------------------------------------------------------
   */

  async refreshDashboard(
    tenantId
  ) {
    if (this.cache) {
      await this.cache.del(
        `dashboard:${tenantId}`
      );
    }

    return this.getDashboard(
      tenantId,
      {
        forceRefresh: true,
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Export
   |--------------------------------------------------------------------------
   */

  async exportDashboard(
    tenantId
  ) {
    const dashboard =
      await this.getDashboard(
        tenantId
      );

    return JSON.stringify(
      dashboard,
      null,
      2
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Audit
   |--------------------------------------------------------------------------
   */

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
        timestamp:
          new Date(),
      });
    } catch (error) {
      this.logger.error(
        'Dashboard audit failed',
        error
      );
    }
  }
}

module.exports =
  ExecutiveDashboardService;