// backend/modules/fraudDetectionService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class FraudDetectionService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    auditService,
    notificationService,
    riskScoringService,
    amlService,
    metricsService,
    ipReputationService,
    deviceFingerprintService,
    geolocationService,
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
    this.amlService = amlService;
    this.metricsService =
      metricsService;
    this.ipReputationService =
      ipReputationService;
    this.deviceFingerprintService =
      deviceFingerprintService;
    this.geolocationService =
      geolocationService;

    this.config = {
      mediumRiskScore: 50,
      highRiskScore: 80,
      velocityLimit: 10,
      velocityWindowMs:
        60 * 60 * 1000,
      transactionThreshold:
        10000000,
      ...config,
    };
  }

  /**
   * ============================================================
   * Public API
   * ============================================================
   */

  async evaluateTransaction(
    transaction,
    context = {}
  ) {
    try {
      const findings = [];

      const velocity =
        await this.checkVelocity(
          transaction
        );

      if (velocity.flagged) {
        findings.push(
          velocity.reason
        );
      }

      const amount =
        this.checkLargeAmount(
          transaction
        );

      if (amount.flagged) {
        findings.push(
          amount.reason
        );
      }

      const geo =
        await this.checkGeoAnomaly(
          transaction,
          context
        );

      if (geo.flagged) {
        findings.push(
          geo.reason
        );
      }

      const device =
        await this.checkDeviceRisk(
          transaction,
          context
        );

      if (device.flagged) {
        findings.push(
          device.reason
        );
      }

      const ip =
        await this.checkIpRisk(
          context
        );

      if (ip.flagged) {
        findings.push(
          ip.reason
        );
      }

      const accountTakeover =
        await this.detectAccountTakeover(
          transaction,
          context
        );

      if (
        accountTakeover.flagged
      ) {
        findings.push(
          accountTakeover.reason
        );
      }

      const score =
        this.calculateRiskScore(
          findings
        );

      const result = {
        transactionId:
          transaction.id,
        customerId:
          transaction.customerId,
        tenantId:
          transaction.tenantId,
        findings,
        score:
          score.score,
        level:
          score.level,
        approved:
          score.level !== 'high',
        createdAt:
          new Date(),
      };

      await this.saveAssessment(
        result
      );

      if (
        result.level === 'high'
      ) {
        await this.createAlert(
          result
        );
      }

      this.emit(
        'fraud.evaluated',
        result
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Fraud evaluation failed',
        error
      );
      throw error;
    }
  }

  /**
   * ============================================================
   * Velocity Detection
   * ============================================================
   */

  async checkVelocity(
    transaction
  ) {
    const count =
      await this.db.transactions.count({
        customerId:
          transaction.customerId,
        createdAt: {
          $gte: new Date(
            Date.now() -
              this.config
                .velocityWindowMs
          ),
        },
      });

    if (
      count >=
      this.config
        .velocityLimit
    ) {
      return {
        flagged: true,
        reason:
          'HIGH_TRANSACTION_VELOCITY',
      };
    }

    return {
      flagged: false,
    };
  }

  /**
   * ============================================================
   * Amount Detection
   * ============================================================
   */

  checkLargeAmount(
    transaction
  ) {
    if (
      transaction.amount >=
      this.config
        .transactionThreshold
    ) {
      return {
        flagged: true,
        reason:
          'LARGE_TRANSACTION',
      };
    }

    return {
      flagged: false,
    };
  }

  /**
   * ============================================================
   * Geo Detection
   * ============================================================
   */

  async checkGeoAnomaly(
    transaction,
    context
  ) {
    if (
      !this.geolocationService ||
      !context.ip
    ) {
      return {
        flagged: false,
      };
    }

    const current =
      await this.geolocationService.lookup(
        context.ip
      );

    const last =
      await this.db.customerSessions.findOne(
        {
          customerId:
            transaction.customerId,
        }
      );

    if (
      !last ||
      !last.country
    ) {
      return {
        flagged: false,
      };
    }

    if (
      current.country !==
      last.country
    ) {
      return {
        flagged: true,
        reason:
          'GEO_LOCATION_ANOMALY',
      };
    }

    return {
      flagged: false,
    };
  }

  /**
   * ============================================================
   * Device Risk
   * ============================================================
   */

  async checkDeviceRisk(
    transaction,
    context
  ) {
    if (
      !this
        .deviceFingerprintService ||
      !context.deviceFingerprint
    ) {
      return {
        flagged: false,
      };
    }

    const device =
      await this.deviceFingerprintService.assess(
        context.deviceFingerprint
      );

    return {
      flagged:
        device.risk === 'high',
      reason:
        'HIGH_RISK_DEVICE',
    };
  }

  /**
   * ============================================================
   * IP Risk
   * ============================================================
   */

  async checkIpRisk(
    context
  ) {
    if (
      !this.ipReputationService ||
      !context.ip
    ) {
      return {
        flagged: false,
      };
    }

    const reputation =
      await this.ipReputationService.lookup(
        context.ip
      );

    return {
      flagged:
        reputation.risk === 'high',
      reason:
        'HIGH_RISK_IP',
    };
  }

  /**
   * ============================================================
   * Account Takeover
   * ============================================================
   */

  async detectAccountTakeover(
    transaction,
    context
  ) {
    const login =
      await this.db.customerSessions.findOne(
        {
          customerId:
            transaction.customerId,
        }
      );

    if (!login) {
      return {
        flagged: false,
      };
    }

    if (
      context.ip &&
      login.ip &&
      context.ip !==
        login.ip
    ) {
      return {
        flagged: true,
        reason:
          'ACCOUNT_TAKEOVER_SUSPECTED',
      };
    }

    return {
      flagged: false,
    };
  }

  /**
   * ============================================================
   * Risk Calculation
   * ============================================================
   */

  calculateRiskScore(
    findings
  ) {
    let score =
      findings.length * 20;

    if (
      findings.includes(
        'ACCOUNT_TAKEOVER_SUSPECTED'
      )
    ) {
      score += 30;
    }

    if (
      findings.includes(
        'HIGH_RISK_IP'
      )
    ) {
      score += 20;
    }

    score =
      Math.min(score, 100);

    let level =
      'low';

    if (
      score >=
      this.config
        .highRiskScore
    ) {
      level = 'high';
    } else if (
      score >=
      this.config
        .mediumRiskScore
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
   * Persist Assessment
   * ============================================================
   */

  async saveAssessment(
    result
  ) {
    await this.db.fraudAssessments.create(
      {
        id:
          crypto.randomUUID(),
        ...result,
      }
    );
  }

  /**
   * ============================================================
   * Alerts
   * ============================================================
   */

  async createAlert(
    result
  ) {
    const alert = {
      id:
        crypto.randomUUID(),
      tenantId:
        result.tenantId,
      customerId:
        result.customerId,
      transactionId:
        result.transactionId,
      findings:
        result.findings,
      score:
        result.score,
      status: 'open',
      createdAt:
        new Date(),
    };

    await this.db.fraudAlerts.create(
      alert
    );

    await this.notificationService?.send(
      {
        tenantId:
          result.tenantId,
        customerId:
          result.customerId,
        type:
          'fraud_alert',
        channel:
          'in_app',
        subject:
          'Fraud Alert',
        message:
          'Suspicious activity detected.',
      }
    );

    await this.audit(
      result.tenantId,
      result.customerId,
      'FRAUD_ALERT_CREATED',
      alert
    );

    this.emit(
      'fraud.alert.created',
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
      await this.db.fraudAlerts.findById(
        alertId
      );

    if (!alert) {
      throw new Error(
        'Fraud alert not found.'
      );
    }

    const fraudCase = {
      id:
        crypto.randomUUID(),
      alertId,
      tenantId:
        alert.tenantId,
      customerId:
        alert.customerId,
      investigatorId,
      status: 'open',
      createdAt:
        new Date(),
    };

    await this.db.fraudCases.create(
      fraudCase
    );

    return fraudCase;
  }

  async closeCase(
    caseId,
    resolution
  ) {
    const fraudCase =
      await this.db.fraudCases.findById(
        caseId
      );

    if (!fraudCase) {
      throw new Error(
        'Fraud case not found.'
      );
    }

    fraudCase.status =
      'closed';
    fraudCase.resolution =
      resolution;
    fraudCase.closedAt =
      new Date();

    await this.db.fraudCases.update(
      caseId,
      fraudCase
    );

    return fraudCase;
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getMetrics() {
    const [
      assessments,
      alerts,
      openCases,
      closedCases,
    ] = await Promise.all([
      this.db.fraudAssessments.count(
        {}
      ),
      this.db.fraudAlerts.count(
        {}
      ),
      this.db.fraudCases.count({
        status: 'open',
      }),
      this.db.fraudCases.count({
        status: 'closed',
      }),
    ]);

    return {
      assessments,
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
        'Fraud audit failed',
        error
      );
    }
  }
}

module.exports =
  FraudDetectionService;