// backend/modules/regulatoryReportingService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const fs = require('fs/promises');
const path = require('path');

class RegulatoryReportingService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    auditService,
    notificationService,
    reportExportService,
    amlService,
    fraudDetectionService,
    kycService,
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
    this.reportExportService =
      reportExportService;
    this.amlService = amlService;
    this.fraudDetectionService =
      fraudDetectionService;
    this.kycService = kycService;
    this.metricsService =
      metricsService;

    this.config = {
      reportsDirectory:
        path.join(
          process.cwd(),
          'storage',
          'reports'
        ),
      largeTransactionThreshold:
        10000000,
      retryAttempts: 5,
      cacheTtl: 300,
      ...config,
    };
  }

  /**
   * ============================================================
   * Report Creation
   * ============================================================
   */

  async createReport({
    tenantId,
    type,
    generatedBy,
    payload = {},
  }) {
    const report = {
      id: crypto.randomUUID(),
      tenantId,
      type,
      status: 'pending',
      version: 1,
      payload,
      generatedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.regulatoryReports.create(
      report
    );

    await this.audit(
      tenantId,
      null,
      'REGULATORY_REPORT_CREATED',
      report
    );

    return report;
  }

  /**
   * ============================================================
   * CTR Report
   * ============================================================
   */

  async generateCTR({
    tenantId,
    from,
    to,
    generatedBy,
  }) {
    const transactions =
      await this.db.transactions.find({
        tenantId,
        amount: {
          $gte:
            this.config
              .largeTransactionThreshold,
        },
        createdAt: {
          $gte: from,
          $lte: to,
        },
      });

    const report =
      await this.createReport({
        tenantId,
        type: 'CTR',
        generatedBy,
        payload: {
          from,
          to,
          transactions,
        },
      });

    return this.exportReport(
      report
    );
  }

  /**
   * ============================================================
   * STR / SAR Report
   * ============================================================
   */

  async generateSTR({
    tenantId,
    generatedBy,
  }) {
    const alerts =
      await this.db.amlAlerts.find({
        tenantId,
        status: 'open',
      });

    const report =
      await this.createReport({
        tenantId,
        type: 'STR',
        generatedBy,
        payload: {
          alerts,
        },
      });

    return this.exportReport(
      report
    );
  }

  async generateSAR({
    tenantId,
    generatedBy,
  }) {
    const cases =
      await this.db.amlCases.find({
        tenantId,
      });

    const report =
      await this.createReport({
        tenantId,
        type: 'SAR',
        generatedBy,
        payload: {
          cases,
        },
      });

    return this.exportReport(
      report
    );
  }

  /**
   * ============================================================
   * KYC Compliance
   * ============================================================
   */

  async generateKYCReport({
    tenantId,
    generatedBy,
  }) {
    const profiles =
      await this.db.kycProfiles.find({
        tenantId,
      });

    const report =
      await this.createReport({
        tenantId,
        type:
          'KYC_COMPLIANCE',
        generatedBy,
        payload: {
          profiles,
        },
      });

    return this.exportReport(
      report
    );
  }

  /**
   * ============================================================
   * Fraud Report
   * ============================================================
   */

  async generateFraudReport({
    tenantId,
    generatedBy,
  }) {
    const alerts =
      await this.db.fraudAlerts.find({
        tenantId,
      });

    const report =
      await this.createReport({
        tenantId,
        type: 'FRAUD',
        generatedBy,
        payload: {
          alerts,
        },
      });

    return this.exportReport(
      report
    );
  }

  /**
   * ============================================================
   * Transaction Report
   * ============================================================
   */

  async generateTransactionReport({
    tenantId,
    from,
    to,
    generatedBy,
  }) {
    const transactions =
      await this.db.transactions.find({
        tenantId,
        createdAt: {
          $gte: from,
          $lte: to,
        },
      });

    const report =
      await this.createReport({
        tenantId,
        type:
          'TRANSACTION',
        generatedBy,
        payload: {
          from,
          to,
          transactions,
        },
      });

    return this.exportReport(
      report
    );
  }

  /**
   * ============================================================
   * Export
   * ============================================================
   */

  async exportReport(
    report,
    format = 'json'
  ) {
    await fs.mkdir(
      this.config
        .reportsDirectory,
      {
        recursive: true,
      }
    );

    const fileName =
      `${report.id}.${format}`;

    const filePath =
      path.join(
        this.config
          .reportsDirectory,
        fileName
      );

    switch (format) {
      case 'csv':
        await this.exportCSV(
          report,
          filePath
        );
        break;

      case 'xml':
        await this.exportXML(
          report,
          filePath
        );
        break;

      default:
        await fs.writeFile(
          filePath,
          JSON.stringify(
            report.payload,
            null,
            2
          )
        );
    }

    report.status =
      'generated';
    report.filePath =
      filePath;
    report.generatedAt =
      new Date();

    await this.db.regulatoryReports.update(
      report.id,
      report
    );

    this.emit(
      'regulatory.report.generated',
      report
    );

    return report;
  }

  /**
   * ============================================================
   * CSV Export
   * ============================================================
   */

  async exportCSV(
    report,
    filePath
  ) {
    const content =
      JSON.stringify(
        report.payload
      );

    await fs.writeFile(
      filePath,
      content
    );
  }

  /**
   * ============================================================
   * XML Export
   * ============================================================
   */

  async exportXML(
    report,
    filePath
  ) {
    const xml = `
<report>
  <id>${report.id}</id>
  <type>${report.type}</type>
  <payload>${JSON.stringify(
    report.payload
  )}</payload>
</report>`;

    await fs.writeFile(
      filePath,
      xml
    );
  }

  /**
   * ============================================================
   * Approval Workflow
   * ============================================================
   */

  async approveReport(
    reportId,
    approvedBy
  ) {
    const report =
      await this.db.regulatoryReports.findById(
        reportId
      );

    if (!report) {
      throw new Error(
        'Report not found.'
      );
    }

    report.status =
      'approved';
    report.approvedBy =
      approvedBy;
    report.approvedAt =
      new Date();

    await this.db.regulatoryReports.update(
      report.id,
      report
    );

    return report;
  }

  /**
   * ============================================================
   * Submission
   * ============================================================
   */

  async submitReport(
    reportId
  ) {
    const report =
      await this.db.regulatoryReports.findById(
        reportId
      );

    if (!report) {
      throw new Error(
        'Report not found.'
      );
    }

    report.status =
      'submitted';
    report.submittedAt =
      new Date();

    await this.db.regulatoryReports.update(
      report.id,
      report
    );

    await this.notificationService?.send(
      {
        tenantId:
          report.tenantId,
        type:
          'regulatory_report_submitted',
        channel:
          'in_app',
        subject:
          'Regulatory Report Submitted',
        message: `${report.type} report submitted successfully.`,
      }
    );

    this.emit(
      'regulatory.report.submitted',
      report
    );

    return report;
  }

  /**
   * ============================================================
   * Scheduling
   * ============================================================
   */

  async scheduleReport(
    payload,
    runAt
  ) {
    return this.queueService.enqueue(
      'regulatory-report',
      payload,
      {
        delay:
          runAt.getTime() -
          Date.now(),
      }
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
      pending,
      generated,
      approved,
      submitted,
    ] = await Promise.all([
      this.db.regulatoryReports.count(
        {}
      ),
      this.db.regulatoryReports.count(
        {
          status:
            'pending',
        }
      ),
      this.db.regulatoryReports.count(
        {
          status:
            'generated',
        }
      ),
      this.db.regulatoryReports.count(
        {
          status:
            'approved',
        }
      ),
      this.db.regulatoryReports.count(
        {
          status:
            'submitted',
        }
      ),
    ]);

    return {
      total,
      pending,
      generated,
      approved,
      submitted,
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
        'Regulatory report audit failed',
        error
      );
    }
  }
}

module.exports =
  RegulatoryReportingService;