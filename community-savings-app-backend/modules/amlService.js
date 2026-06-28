// backend/modules/amlService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class AMLService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    auditService,
    notificationService,
    riskScoringService,
    sanctionsService,
    pepService,
    adverseMediaService,
    reportExportService,
    metricsService,
    config = {},
  }) {
    super();

    this.db = db;
    this.logger = logger;
    this.cache = cache;
    this.queueService = queueService;
    this.auditService = auditService;
    this.notificationService =
      notificationService;
    this.riskScoringService =
      riskScoringService;
    this.sanctionsService =
      sanctionsService;
    this.pepService = pepService;
    this.adverseMediaService =
      adverseMediaService;
    this.reportExportService =
      reportExportService;
    this.metricsService =
      metricsService;

    this.config = {
      cacheTtl: 300,
      transactionThreshold: 10000000,
      highRiskScore: 80,
      mediumRiskScore: 50,
      rescreenDays: 90,
      ...config,
    };
  }

  /**
   * ============================================================
   * Customer Screening
   * ============================================================
   */

  async screen(identity) {
    const cacheKey =
      `aml:${identity.idNumber}`;

    if (this.cache) {
      const cached =
        await this.cache.get(cacheKey);

      if (cached) {
        return cached;
      }
    }

    const [
      sanctions,
      pep,
      adverseMedia,
    ] = await Promise.all([
      this.sanctionsService?.screen(
        identity
      ),
      this.pepService?.screen(
        identity
      ),
      this.adverseMediaService?.screen(
        identity
      ),
    ]);

    const risk =
      this.calculateScreeningRisk({
        sanctions,
        pep,
        adverseMedia,
      });

    const result = {
      sanctions,
      pep,
      adverseMedia,
      risk,
      screenedAt: new Date(),
    };

    if (this.cache) {
      await this.cache.set(
        cacheKey,
        result,
        this.config.cacheTtl
      );
    }

    return result;
  }

  /**
   * ============================================================
   * Transaction Monitoring
   * ============================================================
   */

  async monitorTransaction(
    transaction
  ) {
    try {
      const findings = [];

      if (
        transaction.amount >=
        this.config.transactionThreshold
      ) {
        findings.push(
          'LARGE_TRANSACTION'
        );
      }

      const structuring =
        await this.detectStructuring(
          transaction
        );

      if (structuring) {
        findings.push(
          'STRUCTURING'
        );
      }

      const velocity =
        await this.detectVelocity(
          transaction
        );

      if (velocity) {
        findings.push(
          'HIGH_VELOCITY'
        );
      }

      const suspicious =
        findings.length > 0;

      const result = {
        suspicious,
        findings,
        reviewedAt: new Date(),
      };

      if (suspicious) {
        await this.createAlert({
          tenantId:
            transaction.tenantId,
          customerId:
            transaction.customerId,
          transactionId:
            transaction.id,
          findings,
          severity:
            findings.length > 1
              ? 'high'
              : 'medium',
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        'AML transaction monitoring failed',
        error
      );
      throw error;
    }
  }

  /**
   * ============================================================
   * Structuring Detection
   * ============================================================
   */

  async detectStructuring(
    transaction
  ) {
    const transactions =
      await this.db.transactions.find({
        customerId:
          transaction.customerId,
        createdAt: {
          $gte: new Date(
            Date.now() -
              24 *
                60 *
                60 *
                1000
          ),
        },
      });

    const total =
      transactions.reduce(
        (sum, tx) =>
          sum + tx.amount,
        0
      );

    return (
      total >=
      this.config.transactionThreshold
    );
  }

  /**
   * ============================================================
   * Velocity Detection
   * ============================================================
   */

  async detectVelocity(
    transaction
  ) {
    const count =
      await this.db.transactions.count({
        customerId:
          transaction.customerId,
        createdAt: {
          $gte: new Date(
            Date.now() -
              60 *
                60 *
                1000
          ),
        },
      });

    return count >= 20;
  }

  /**
   * ============================================================
   * Alert Management
   * ============================================================
   */

  async createAlert({
    tenantId,
    customerId,
    transactionId,
    findings,
    severity,
  }) {
    const alert = {
      id: crypto.randomUUID(),
      tenantId,
      customerId,
      transactionId,
      findings,
      severity,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.amlAlerts.create(
      alert
    );

    await this.notificationService?.send(
      {
        tenantId,
        type:
          'aml_alert_created',
        data: alert,
      }
    );

    await this.audit(
      tenantId,
      customerId,
      'AML_ALERT_CREATED',
      alert
    );

    this.emit(
      'aml.alert.created',
      alert
    );

    return alert;
  }

  /**
   * ============================================================
   * Case Management
   * ============================================================
   */

  async openCase(
    alertId,
    investigatorId
  ) {
    const alert =
      await this.db.amlAlerts.findById(
        alertId
      );

    if (!alert) {
      throw new Error(
        'AML alert not found.'
      );
    }

    const amlCase = {
      id: crypto.randomUUID(),
      alertId,
      tenantId:
        alert.tenantId,
      customerId:
        alert.customerId,
      investigatorId,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.amlCases.create(
      amlCase
    );

    return amlCase;
  }

  async closeCase(
    caseId,
    resolution
  ) {
    const amlCase =
      await this.db.amlCases.findById(
        caseId
      );

    if (!amlCase) {
      throw new Error(
        'Case not found.'
      );
    }

    amlCase.status =
      'closed';
    amlCase.resolution =
      resolution;
    amlCase.closedAt =
      new Date();

    await this.db.amlCases.update(
      caseId,
      amlCase
    );

    return amlCase;
  }

  /**
   * ============================================================
   * Enhanced Due Diligence
   * ============================================================
   */

  async performEDD(
    tenantId,
    customerId
  ) {
    const customer =
      await this.db.customers.findById(
        customerId
      );

    const screening =
      await this.screen(
        customer
      );

    const risk =
      await this.riskScoringService
        ?.scoreAML({
          customer,
          screening,
        });

    return {
      customer,
      screening,
      risk,
      performedAt:
        new Date(),
    };
  }

  /**
   * ============================================================
   * Periodic Rescreening
   * ============================================================
   */

  async processRescreening() {
    const customers =
      await this.db.customers.find({
        amlLastScreenedAt: {
          $lte: new Date(
            Date.now() -
              this.config
                .rescreenDays *
                24 *
                60 *
                60 *
                1000
          ),
        },
      });

    for (const customer of customers) {
      await this.queueService.enqueue(
        'aml-rescreen',
        {
          customerId:
            customer.id,
          tenantId:
            customer.tenantId,
        }
      );
    }
  }

  /**
   * ============================================================
   * SAR / STR
   * ============================================================
   */

  async generateSAR(caseId) {
    const amlCase =
      await this.db.amlCases.findById(
        caseId
      );

    if (!amlCase) {
      throw new Error(
        'Case not found.'
      );
    }

    return this.reportExportService.exportSAR(
      amlCase
    );
  }

  async generateSTR(caseId) {
    const amlCase =
      await this.db.amlCases.findById(
        caseId
      );

    if (!amlCase) {
      throw new Error(
        'Case not found.'
      );
    }

    return this.reportExportService.exportSTR(
      amlCase
    );
  }

  /**
   * ============================================================
   * Risk Calculation
   * ============================================================
   */

  calculateScreeningRisk(
    screening
  ) {
    let score = 0;

    if (
      screening.sanctions?.matches
        ?.length
    ) {
      score += 100;
    }

    if (
      screening.pep?.matches
        ?.length
    ) {
      score += 50;
    }

    if (
      screening.adverseMedia
        ?.matches?.length
    ) {
      score += 25;
    }

    let level = 'low';

    if (
      score >=
      this.config.highRiskScore
    ) {
      level = 'high';
    } else if (
      score >=
      this.config.mediumRiskScore
    ) {
      level = 'medium';
    }

    return {
      score,
      level,
    };
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getMetrics() {
    const [
      alerts,
      openCases,
      closedCases,
    ] = await Promise.all([
      this.db.amlAlerts.count({}),
      this.db.amlCases.count({
        status: 'open',
      }),
      this.db.amlCases.count({
        status: 'closed',
      }),
    ]);

    return {
      alerts,
      openCases,
      closedCases,
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
    payload = {}
  ) {
    if (!this.auditService) {
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
        'AML audit failed',
        error
      );
    }
  }
}

module.exports = AMLService;