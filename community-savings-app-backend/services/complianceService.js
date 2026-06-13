// services/complianceService.js

const ComplianceLog = require('../models/ComplianceLog');

class ComplianceService {
  /**
   * ✅ KYC VERIFICATION
   */
  static async verifyKYC(userData = {}) {
    const { _id, tenantId, nationalId, phone, address } = userData;

    // ✅ Basic validation
    if (!nationalId || !phone || !address) {
      throw new Error('Incomplete KYC data');
    }

    // ✅ Simple verification logic (can plug into NIRA / API later)
    const verified = nationalId.startsWith('CF');
    const riskLevel = verified ? 'LOW' : 'HIGH';

    // ✅ Audit log
    const log = await ComplianceLog.create({
      userId: _id,
      tenantId,
      activity: 'KYC_VERIFICATION',
      flagged: !verified,
      reportId: `KYC-${Date.now()}`,
      createdAt: new Date()
    });

    return { verified, riskLevel, log };
  }

  /**
   * ✅ RISK LEVEL CALCULATION (TRANSACTION-BASED AML CHECK)
   */
  static async calculateRiskLevel(user = {}) {
    const { _id, tenantId, transactionVolume = 0 } = user;

    let level = 'LOW';

    if (transactionVolume > 10000000) level = 'HIGH';
    else if (transactionVolume > 2000000) level = 'MEDIUM';

    // ✅ AML audit log
    await ComplianceLog.create({
      userId: _id,
      tenantId,
      activity: 'RISK_ASSESSMENT',
      flagged: level === 'HIGH',
      reportId: `RISK-${Date.now()}`,
      createdAt: new Date()
    });

    return level;
  }

  /**
   * ✅ STR (Suspicious Transaction Report)
   */
  static async generateSTR(userId, reason = 'Suspicious activity detected') {
    const reportId = `STR-${Date.now()}`;

    const log = await ComplianceLog.create({
      userId,
      activity: 'STR',
      flagged: true,
      reportId,
      reason,
      createdAt: new Date()
    });

    return log;
  }
}

module.exports = ComplianceService;