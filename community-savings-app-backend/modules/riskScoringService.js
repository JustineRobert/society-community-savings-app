// backend/modules/riskScoringService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class RiskScoringService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    auditService,
    metricsService,
    config = {},
  }) {
    super();

    this.db = db;
    this.logger = logger;
    this.cache = cache;
    this.queueService = queueService;
    this.auditService = auditService;
    this.metricsService = metricsService;

    this.config = {
      cacheTtl: 300,

      thresholds: {
        low: 30,
        medium: 60,
        high: 80,
      },

      weights: {
        kyc: 0.20,
        aml: 0.20,
        fraud: 0.25,
        credit: 0.25,
        transaction: 0.10,
      },

      ...config,
    };
  }

  /**
   * ============================================================
   * Public Scoring APIs
   * ============================================================
   */

  async scoreCustomer(customer) {
    try {
      const cacheKey =
        `risk:customer:${customer.id}`;

      const cached =
        await this.getCache(
          cacheKey
        );

      if (cached) {
        return cached;
      }

      const [
        kyc,
        aml,
        fraud,
        credit,
        transaction,
      ] = await Promise.all([
        this.scoreKYC(customer),
        this.scoreAML(customer),
        this.scoreFraud(customer),
        this.scoreCredit(customer),
        this.scoreTransactions(
          customer
        ),
      ]);

      const score =
        this.calculateCompositeScore(
          {
            kyc,
            aml,
            fraud,
            credit,
            transaction,
          }
        );

      const profile = {
        customerId:
          customer.id,
        tenantId:
          customer.tenantId,
        ...score,
        factors: {
          kyc,
          aml,
          fraud,
          credit,
          transaction,
        },
        calculatedAt:
          new Date(),
      };

      await this.persistScore(
        profile
      );

      await this.setCache(
        cacheKey,
        profile
      );

      return profile;
    } catch (error) {
      this.logger.error(
        'Customer risk scoring failed',
        error
      );
      throw error;
    }
  }

  /**
   * ============================================================
   * KYC Risk
   * ============================================================
   */

  async scoreKYC(profile) {
    let score = 0;
    const reasons = [];

    if (
      profile.status ===
      'rejected'
    ) {
      score += 80;
      reasons.push(
        'KYC_REJECTED'
      );
    }

    if (
      profile.status ===
      'pending'
    ) {
      score += 40;
      reasons.push(
        'KYC_PENDING'
      );
    }

    if (
      profile.riskLevel ===
      'high'
    ) {
      score += 40;
      reasons.push(
        'HIGH_RISK_KYC'
      );
    }

    return {
      score:
        Math.min(score, 100),
      reasons,
    };
  }

  /**
   * ============================================================
   * AML Risk
   * ============================================================
   */

  async scoreAML(data) {
    let score = 0;
    const reasons = [];

    const screening =
      data.screening ||
      {};

    if (
      screening.sanctions
        ?.matches?.length
    ) {
      score += 100;
      reasons.push(
        'SANCTIONS_MATCH'
      );
    }

    if (
      screening.pep
        ?.matches?.length
    ) {
      score += 50;
      reasons.push(
        'PEP_MATCH'
      );
    }

    if (
      screening
        .adverseMedia
        ?.matches?.length
    ) {
      score += 25;
      reasons.push(
        'ADVERSE_MEDIA'
      );
    }

    return {
      score:
        Math.min(score, 100),
      reasons,
    };
  }

  /**
   * ============================================================
   * Fraud Risk
   * ============================================================
   */

  async scoreFraud(data) {
    let score = 0;
    const reasons = [];

    if (
      data.fraudAlerts >
      0
    ) {
      score += 50;
      reasons.push(
        'FRAUD_ALERTS'
      );
    }

    if (
      data.accountLocked
    ) {
      score += 20;
      reasons.push(
        'ACCOUNT_LOCKED'
      );
    }

    return {
      score:
        Math.min(score, 100),
      reasons,
    };
  }

  /**
   * ============================================================
   * Credit Risk
   * ============================================================
   */

  async scoreCredit(data) {
    let score = 0;
    const reasons = [];

    if (
      data.defaultedLoans >
      0
    ) {
      score += 70;
      reasons.push(
        'DEFAULTED_LOANS'
      );
    }

    if (
      data.overdueLoans >
      0
    ) {
      score += 40;
      reasons.push(
        'OVERDUE_LOANS'
      );
    }

    if (
      data.creditScore &&
      data.creditScore <
        500
    ) {
      score += 40;
      reasons.push(
        'LOW_CREDIT_SCORE'
      );
    }

    return {
      score:
        Math.min(score, 100),
      reasons,
    };
  }

  /**
   * ============================================================
   * Transaction Risk
   * ============================================================
   */

  async scoreTransactions(
    customer
  ) {
    let score = 0;
    const reasons = [];

    const transactions =
      await this.db.transactions.find({
        customerId:
          customer.id,
        createdAt: {
          $gte: new Date(
            Date.now() -
              30 *
                24 *
                60 *
                60 *
                1000
          ),
        },
      });

    const count =
      transactions.length;

    const volume =
      transactions.reduce(
        (sum, tx) =>
          sum + tx.amount,
        0
      );

    if (count > 500) {
      score += 25;
      reasons.push(
        'HIGH_VOLUME'
      );
    }

    if (
      volume >
      50000000
    ) {
      score += 25;
      reasons.push(
        'HIGH_VALUE'
      );
    }

    return {
      score,
      reasons,
      count,
      volume,
    };
  }

  /**
   * ============================================================
   * Composite Score
   * ============================================================
   */

  calculateCompositeScore(
    factors
  ) {
    const weights =
      this.config.weights;

    const score =
      factors.kyc.score *
        weights.kyc +
      factors.aml.score *
        weights.aml +
      factors.fraud.score *
        weights.fraud +
      factors.credit.score *
        weights.credit +
      factors.transaction
        .score *
        weights.transaction;

    return {
      score:
        Math.round(score),
      level:
        this.determineRiskLevel(
          score
        ),
    };
  }

  /**
   * ============================================================
   * Determine Risk Level
   * ============================================================
   */

  determineRiskLevel(
    score
  ) {
    if (
      score >=
      this.config
        .thresholds.high
    ) {
      return 'high';
    }

    if (
      score >=
      this.config
        .thresholds.medium
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * ============================================================
   * Monitoring
   * ============================================================
   */

  async monitorCustomer(
    customerId
  ) {
    const customer =
      await this.db.customers.findById(
        customerId
      );

    if (!customer) {
      throw new Error(
        'Customer not found.'
      );
    }

    const score =
      await this.scoreCustomer(
        customer
      );

    if (
      score.level ===
      'high'
    ) {
      await this.queueService.enqueue(
        'high-risk-customer',
        {
          customerId,
          tenantId:
            customer.tenantId,
        }
      );
    }

    return score;
  }

  /**
   * ============================================================
   * Score Persistence
   * ============================================================
   */

  async persistScore(
    profile
  ) {
    const record = {
      id:
        crypto.randomUUID(),
      ...profile,
    };

    await this.db.riskScores.create(
      record
    );

    this.emit(
      'risk.score.created',
      record
    );

    await this.audit(
      profile.tenantId,
      profile.customerId,
      'RISK_SCORE_CREATED',
      record
    );

    return record;
  }

  /**
   * ============================================================
   * Retrieval
   * ============================================================
   */

  async getLatestScore(
    customerId
  ) {
    return this.db.riskScores.findOne(
      {
        customerId,
      },
      {
        sort: {
          calculatedAt: -1,
        },
      }
    );
  }

  /**
   * ============================================================
   * Cache Helpers
   * ============================================================
   */

  async getCache(
    key
  ) {
    if (!this.cache) {
      return null;
    }

    return this.cache.get(
      key
    );
  }

  async setCache(
    key,
    value
  ) {
    if (!this.cache) {
      return;
    }

    await this.cache.set(
      key,
      value,
      this.config.cacheTtl
    );
  }

  async invalidateCustomer(
    customerId
  ) {
    if (!this.cache) {
      return;
    }

    await this.cache.del(
      `risk:customer:${customerId}`
    );
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getMetrics() {
    const [
      total,
      low,
      medium,
      high,
    ] = await Promise.all([
      this.db.riskScores.count(
        {}
      ),
      this.db.riskScores.count(
        {
          level: 'low',
        }
      ),
      this.db.riskScores.count(
        {
          level: 'medium',
        }
      ),
      this.db.riskScores.count(
        {
          level: 'high',
        }
      ),
    ]);

    return {
      total,
      low,
      medium,
      high,
    };
  }

  /**
   * ============================================================
   * Audit
   * ============================================================
   */

  async audit(
    tenantId,
    customerId,
    action,
    payload
  ) {
    if (
      !this.auditService
    ) {
      return;
    }

    try {
      await this.auditService.log({
        tenantId,
        customerId,
        action,
        payload,
        timestamp:
          new Date(),
      });
    } catch (error) {
      this.logger.error(
        'Risk score audit failed',
        error
      );
    }
  }
}

module.exports =
  RiskScoringService;