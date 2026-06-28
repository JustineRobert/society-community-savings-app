// backend/modules/disasterRecoveryService.js
'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const EventEmitter = require('events');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class DisasterRecoveryService extends EventEmitter {
  constructor({
    db,
    cache,
    logger,
    queueService,
    auditService,
    notificationService,
    metricsService,
    objectStorageService,
    encryptionService,
    config = {},
  }) {
    super();

    this.db = db;
    this.cache = cache;
    this.logger = logger;
    this.queueService = queueService;
    this.auditService = auditService;
    this.notificationService =
      notificationService;
    this.metricsService =
      metricsService;
    this.objectStorageService =
      objectStorageService;
    this.encryptionService =
      encryptionService;

    this.config = {
      backupDirectory: path.join(
        process.cwd(),
        'storage',
        'backups'
      ),
      retentionDays: 30,
      compression: true,
      encryption: true,
      defaultRPOMinutes: 15,
      defaultRTOMinutes: 60,
      ...config,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Create Backup
   |--------------------------------------------------------------------------
   */

  async createBackup({
    tenantId = null,
    type = 'full',
    createdBy = 'system',
  } = {}) {
    try {
      await fs.mkdir(
        this.config
          .backupDirectory,
        {
          recursive: true,
        }
      );

      const backupId =
        crypto.randomUUID();

      const timestamp =
        new Date();

      const backup = {
        id: backupId,
        tenantId,
        type,
        status: 'running',
        createdBy,
        createdAt:
          timestamp,
      };

      await this.db.backups.create(
        backup
      );

      const payload =
        await this.buildBackupPayload(
          tenantId,
          type
        );

      let content =
        Buffer.from(
          JSON.stringify(
            payload
          )
        );

      if (
        this.config
          .compression
      ) {
        content =
          await gzip(
            content
          );
      }

      if (
        this.config
          .encryption &&
        this
          .encryptionService
      ) {
        content =
          await this.encryptionService.encrypt(
            content
          );
      }

      const fileName =
        `${backupId}.backup`;

      const filePath =
        path.join(
          this.config
            .backupDirectory,
          fileName
        );

      await fs.writeFile(
        filePath,
        content
      );

      backup.status =
        'completed';
      backup.filePath =
        filePath;
      backup.size =
        content.length;
      backup.completedAt =
        new Date();

      await this.db.backups.update(
        backupId,
        backup
      );

      await this.audit(
        tenantId,
        'BACKUP_CREATED',
        backup
      );

      this.emit(
        'backup.completed',
        backup
      );

      return backup;
    } catch (error) {
      this.logger.error(
        'Backup creation failed',
        error
      );

      throw error;
    }
  }

  /*
   |--------------------------------------------------------------------------
   | Build Backup Payload
   |--------------------------------------------------------------------------
   */

  async buildBackupPayload(
    tenantId,
    type
  ) {
    const payload = {
      metadata: {
        tenantId,
        type,
        timestamp:
          new Date(),
      },
      collections: {},
    };

    const collections = [
      'customers',
      'accounts',
      'transactions',
      'loans',
      'savingsAccounts',
      'subscriptions',
      'invoices',
      'kycProfiles',
      'fraudAlerts',
      'amlAlerts',
    ];

    for (const name of collections) {
      if (
        !this.db[name]
      ) {
        continue;
      }

      const query =
        tenantId
          ? { tenantId }
          : {};

      payload.collections[
        name
      ] =
        await this.db[
          name
        ].find(query);
    }

    return payload;
  }

  /*
   |--------------------------------------------------------------------------
   | Restore Backup
   |--------------------------------------------------------------------------
   */

  async restoreBackup(
    backupId,
    options = {}
  ) {
    const backup =
      await this.db.backups.findById(
        backupId
      );

    if (!backup) {
      throw new Error(
        'Backup not found.'
      );
    }

    let content =
      await fs.readFile(
        backup.filePath
      );

    if (
      this.config
        .encryption &&
      this
        .encryptionService
    ) {
      content =
        await this.encryptionService.decrypt(
          content
        );
    }

    if (
      this.config
        .compression
    ) {
      content =
        await gunzip(
          content
        );
    }

    const payload =
      JSON.parse(
        content.toString()
      );

    for (const [
      collection,
      records,
    ] of Object.entries(
      payload.collections
    )) {
      if (
        !this.db[
          collection
        ]
      ) {
        continue;
      }

      if (
        options.clearExisting
      ) {
        await this.db[
          collection
        ].deleteMany(
          {}
        );
      }

      for (const record of records) {
        await this.db[
          collection
        ].upsert(
          record
        );
      }
    }

    await this.audit(
      payload.metadata
        .tenantId,
      'BACKUP_RESTORED',
      {
        backupId,
      }
    );

    this.emit(
      'backup.restored',
      backup
    );

    return {
      success: true,
      backupId,
    };
  }

  /*
   |--------------------------------------------------------------------------
   | Point In Time Recovery
   |--------------------------------------------------------------------------
   */

  async restoreToPointInTime(
    timestamp
  ) {
    const backup =
      await this.db.backups.findOne(
        {
          completedAt: {
            $lte:
              timestamp,
          },
        },
        {
          sort: {
            completedAt:
              -1,
          },
        }
      );

    if (!backup) {
      throw new Error(
        'No suitable backup found.'
      );
    }

    return this.restoreBackup(
      backup.id
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Backup Verification
   |--------------------------------------------------------------------------
   */

  async verifyBackup(
    backupId
  ) {
    const backup =
      await this.db.backups.findById(
        backupId
      );

    if (!backup) {
      throw new Error(
        'Backup not found.'
      );
    }

    try {
      await fs.access(
        backup.filePath
      );

      return {
        backupId,
        valid: true,
      };
    } catch (error) {
      return {
        backupId,
        valid: false,
      };
    }
  }

  /*
   |--------------------------------------------------------------------------
   | Failover
   |--------------------------------------------------------------------------
   */

  async initiateFailover(
    region
  ) {
    const event = {
      id:
        crypto.randomUUID(),
      region,
      startedAt:
        new Date(),
      status:
        'completed',
    };

    await this.db.failovers.create(
      event
    );

    await this.notificationService?.send(
      {
        type:
          'system_failover',
        channel:
          'in_app',
        subject:
          'Disaster Recovery Failover',
        message: `Failover initiated to ${region}`,
      }
    );

    this.emit(
      'failover.completed',
      event
    );

    return event;
  }

  /*
   |--------------------------------------------------------------------------
   | Failback
   |--------------------------------------------------------------------------
   */

  async initiateFailback(
    region
  ) {
    const event = {
      id:
        crypto.randomUUID(),
      region,
      startedAt:
        new Date(),
      status:
        'completed',
    };

    await this.db.failbacks.create(
      event
    );

    this.emit(
      'failback.completed',
      event
    );

    return event;
  }

  /*
   |--------------------------------------------------------------------------
   | Recovery Drill
   |--------------------------------------------------------------------------
   */

  async executeRecoveryDrill() {
    const startedAt =
      Date.now();

    const latest =
      await this.db.backups.findOne(
        {},
        {
          sort: {
            completedAt:
              -1,
          },
        }
      );

    if (!latest) {
      throw new Error(
        'No backups available.'
      );
    }

    const verification =
      await this.verifyBackup(
        latest.id
      );

    const duration =
      Date.now() -
      startedAt;

    const drill = {
      id:
        crypto.randomUUID(),
      backupId:
        latest.id,
      success:
        verification.valid,
      duration,
      createdAt:
        new Date(),
    };

    await this.db.recoveryDrills.create(
      drill
    );

    return drill;
  }

  /*
   |--------------------------------------------------------------------------
   | Snapshot Management
   |--------------------------------------------------------------------------
   */

  async createSnapshot(
    tenantId
  ) {
    return this.createBackup({
      tenantId,
      type:
        'snapshot',
      createdBy:
        'system',
    });
  }

  /*
   |--------------------------------------------------------------------------
   | Scheduled Backup
   |--------------------------------------------------------------------------
   */

  async scheduleBackup(
    payload,
    runAt
  ) {
    return this.queueService.enqueue(
      'disaster-recovery-backup',
      payload,
      {
        delay:
          runAt.getTime() -
          Date.now(),
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Cleanup
   |--------------------------------------------------------------------------
   */

  async cleanupExpiredBackups() {
    const cutoff =
      new Date(
        Date.now() -
          this.config
            .retentionDays *
            24 *
            60 *
            60 *
            1000
      );

    const backups =
      await this.db.backups.find(
        {
          completedAt: {
            $lt:
              cutoff,
          },
        }
      );

    for (const backup of backups) {
      try {
        await fs.unlink(
          backup.filePath
        );

        await this.db.backups.delete(
          backup.id
        );
      } catch (error) {
        this.logger.error(
          'Backup cleanup failed',
          error
        );
      }
    }

    return backups.length;
  }

  /*
   |--------------------------------------------------------------------------
   | Metrics
   |--------------------------------------------------------------------------
   */

  async getMetrics() {
    const [
      backups,
      drills,
      failovers,
    ] = await Promise.all([
      this.db.backups.count(
        {}
      ),
      this.db.recoveryDrills.count(
        {}
      ),
      this.db.failovers.count(
        {}
      ),
    ]);

    return {
      backups,
      drills,
      failovers,
      rpoMinutes:
        this.config
          .defaultRPOMinutes,
      rtoMinutes:
        this.config
          .defaultRTOMinutes,
    };
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
    if (
      !this.auditService
    ) {
      return;
    }

    try {
      await this.auditService.log(
        {
          tenantId,
          action,
          payload,
          timestamp:
            new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        'Disaster recovery audit failed',
        error
      );
    }
  }
}

module.exports =
  DisasterRecoveryService;