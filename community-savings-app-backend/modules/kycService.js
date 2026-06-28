// backend/modules/kycService.js
'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

class KYCService extends EventEmitter {
  constructor({
    db,
    logger,
    cache,
    queueService,
    notificationService,
    documentStorageService,
    auditService,
    riskScoringService,
    amlService,
    sanctionsService,
    ocrService,
    faceVerificationService,
    identityProvider,
    metricsService,
    config = {},
  }) {
    super();

    this.db = db;
    this.logger = logger;
    this.cache = cache;
    this.queueService = queueService;
    this.notificationService =
      notificationService;
    this.documentStorageService =
      documentStorageService;
    this.auditService = auditService;
    this.riskScoringService =
      riskScoringService;
    this.amlService = amlService;
    this.sanctionsService =
      sanctionsService;
    this.ocrService = ocrService;
    this.faceVerificationService =
      faceVerificationService;
    this.identityProvider =
      identityProvider;
    this.metricsService =
      metricsService;

    this.config = {
      cacheTtl: 300,
      expiryMonths: 12,
      autoScreening: true,
      enableFaceVerification: true,
      enableOCR: true,
      ...config,
    };
  }

  /**
   * ============================================================
   * Create KYC Profile
   * ============================================================
   */

  async createProfile({
    tenantId,
    customerId,
    type = 'individual',
    metadata = {},
  }) {
    const existing =
      await this.getProfile(
        tenantId,
        customerId
      );

    if (existing) {
      return existing;
    }

    const profile = {
      id: crypto.randomUUID(),
      tenantId,
      customerId,
      type,
      status: 'pending',
      verificationLevel: 0,
      riskLevel: 'unknown',
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.kycProfiles.create(
      profile
    );

    await this.audit(
      tenantId,
      customerId,
      'KYC_PROFILE_CREATED',
      profile
    );

    return profile;
  }

  /**
   * ============================================================
   * Get Profile
   * ============================================================
   */

  async getProfile(
    tenantId,
    customerId
  ) {
    const cacheKey =
      `kyc:${tenantId}:${customerId}`;

    if (this.cache) {
      const cached =
        await this.cache.get(cacheKey);

      if (cached) {
        return cached;
      }
    }

    const profile =
      await this.db.kycProfiles.findOne({
        tenantId,
        customerId,
      });

    if (
      profile &&
      this.cache
    ) {
      await this.cache.set(
        cacheKey,
        profile,
        this.config.cacheTtl
      );
    }

    return profile;
  }

  /**
   * ============================================================
   * Submit Identity Information
   * ============================================================
   */

  async submitIdentity({
    tenantId,
    customerId,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    nationality,
    idType,
    idNumber,
    phoneNumber,
    email,
    address,
  }) {
    const profile =
      await this.createProfile({
        tenantId,
        customerId,
      });

    profile.identity = {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      nationality,
      idType,
      idNumber,
      phoneNumber,
      email,
      address,
    };

    profile.updatedAt =
      new Date();

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    await this.invalidateCache(
      tenantId,
      customerId
    );

    return profile;
  }

  /**
   * ============================================================
   * Upload Documents
   * ============================================================
   */

  async uploadDocument({
    tenantId,
    customerId,
    documentType,
    file,
  }) {
    const profile =
      await this.getProfile(
        tenantId,
        customerId
      );

    if (!profile) {
      throw new Error(
        'KYC profile not found.'
      );
    }

    const stored =
      await this.documentStorageService.upload(
        {
          tenantId,
          customerId,
          file,
        }
      );

    const document = {
      id: crypto.randomUUID(),
      type: documentType,
      fileId: stored.id,
      fileName: stored.fileName,
      status: 'uploaded',
      uploadedAt: new Date(),
    };

    profile.documents =
      profile.documents || [];

    profile.documents.push(
      document
    );

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    if (
      this.config.enableOCR &&
      this.ocrService
    ) {
      await this.queueService.enqueue(
        'kyc-ocr',
        {
          tenantId,
          customerId,
          documentId: document.id,
        }
      );
    }

    return document;
  }

  /**
   * ============================================================
   * OCR Verification
   * ============================================================
   */

  async processOCR({
    tenantId,
    customerId,
    document,
  }) {
    return this.ocrService.extract(
      document
    );
  }

  /**
   * ============================================================
   * Face Verification
   * ============================================================
   */

  async verifyFace({
    tenantId,
    customerId,
    selfie,
    documentImage,
  }) {
    if (
      !this.faceVerificationService
    ) {
      return {
        verified: false,
      };
    }

    return this.faceVerificationService.compare(
      selfie,
      documentImage
    );
  }

  /**
   * ============================================================
   * Identity Verification
   * ============================================================
   */

  async verifyIdentity(
    tenantId,
    customerId
  ) {
    const profile =
      await this.getProfile(
        tenantId,
        customerId
      );

    if (!profile) {
      throw new Error(
        'Profile not found.'
      );
    }

    if (
      !this.identityProvider
    ) {
      return {
        verified: false,
        reason:
          'Identity provider unavailable',
      };
    }

    const result =
      await this.identityProvider.verify(
        profile.identity
      );

    profile.identityVerification =
      result;

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    return result;
  }

  /**
   * ============================================================
   * AML Screening
   * ============================================================
   */

  async performScreening(
    tenantId,
    customerId
  ) {
    const profile =
      await this.getProfile(
        tenantId,
        customerId
      );

    const identity =
      profile.identity;

    const [
      sanctions,
      aml,
    ] = await Promise.all([
      this.sanctionsService?.screen(
        identity
      ),
      this.amlService?.screen(
        identity
      ),
    ]);

    profile.screening = {
      sanctions,
      aml,
      screenedAt: new Date(),
    };

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    return profile.screening;
  }

  /**
   * ============================================================
   * Risk Assessment
   * ============================================================
   */

  async assessRisk(
    tenantId,
    customerId
  ) {
    const profile =
      await this.getProfile(
        tenantId,
        customerId
      );

    const risk =
      await this.riskScoringService.scoreKYC(
        profile
      );

    profile.riskLevel =
      risk.level;
    profile.riskScore =
      risk.score;

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    return risk;
  }

  /**
   * ============================================================
   * Approve KYC
   * ============================================================
   */

  async approve({
    tenantId,
    customerId,
    approvedBy,
  }) {
    const profile =
      await this.getProfile(
        tenantId,
        customerId
      );

    profile.status =
      'approved';

    profile.approvedBy =
      approvedBy;
    profile.approvedAt =
      new Date();

    profile.expiresAt =
      new Date(
        Date.now() +
          this.config.expiryMonths *
            30 *
            24 *
            60 *
            60 *
            1000
      );

    profile.verificationLevel =
      3;

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    await this.notificationService?.send(
      {
        tenantId,
        customerId,
        type:
          'kyc_approved',
      }
    );

    await this.audit(
      tenantId,
      customerId,
      'KYC_APPROVED',
      profile
    );

    this.emit(
      'kyc.approved',
      profile
    );

    return profile;
  }

  /**
   * ============================================================
   * Reject KYC
   * ============================================================
   */

  async reject({
    tenantId,
    customerId,
    reason,
    rejectedBy,
  }) {
    const profile =
      await this.getProfile(
        tenantId,
        customerId
      );

    profile.status =
      'rejected';

    profile.rejectionReason =
      reason;

    profile.rejectedBy =
      rejectedBy;

    profile.rejectedAt =
      new Date();

    await this.db.kycProfiles.update(
      profile.id,
      profile
    );

    await this.notificationService?.send(
      {
        tenantId,
        customerId,
        type:
          'kyc_rejected',
        reason,
      }
    );

    await this.audit(
      tenantId,
      customerId,
      'KYC_REJECTED',
      profile
    );

    return profile;
  }

  /**
   * ============================================================
   * Expiry & Reverification
   * ============================================================
   */

  async processExpirations() {
    const profiles =
      await this.db.kycProfiles.find({
        status: 'approved',
        expiresAt: {
          $lte: new Date(),
        },
      });

    for (const profile of profiles) {
      profile.status =
        'expired';

      await this.db.kycProfiles.update(
        profile.id,
        profile
      );

      await this.queueService.enqueue(
        'kyc-reverification',
        {
          tenantId:
            profile.tenantId,
          customerId:
            profile.customerId,
        }
      );
    }
  }

  /**
   * ============================================================
   * Metrics
   * ============================================================
   */

  async getMetrics() {
    const [
      approved,
      pending,
      rejected,
      expired,
    ] = await Promise.all([
      this.db.kycProfiles.count({
        status: 'approved',
      }),
      this.db.kycProfiles.count({
        status: 'pending',
      }),
      this.db.kycProfiles.count({
        status: 'rejected',
      }),
      this.db.kycProfiles.count({
        status: 'expired',
      }),
    ]);

    return {
      approved,
      pending,
      rejected,
      expired,
    };
  }

  /**
   * ============================================================
   * Cache
   * ============================================================
   */

  async invalidateCache(
    tenantId,
    customerId
  ) {
    if (!this.cache) {
      return;
    }

    await this.cache.del(
      `kyc:${tenantId}:${customerId}`
    );
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
        'KYC audit failed',
        error
      );
    }
  }
}

module.exports = KYCService;