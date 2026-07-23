/**
 * ============================================================================
 * TITech Community Capital LTD
 * Device Fingerprint Service
 * ============================================================================
 * Enterprise Device Fingerprinting Engine
 * ============================================================================
 * Features
 * - Unique device fingerprint generation
 * - Browser & OS metadata capture
 * - IP & geolocation binding
 * - Risk scoring for new/unknown devices
 * - Device reputation tracking
 * - Continuous monitoring
 * - Audit logging
 * ============================================================================
 */

const crypto = require("crypto");
const DeviceFingerprint = require("../../models/DeviceFingerprint");
const RiskAlert = require("../../models/RiskAlert");

class DeviceFingerprintService {
    constructor() {
        this.config = {
            thresholds: {
                BLOCK: 80,
                REVIEW: 50,
                APPROVE: 0,
            },
            reputationWeights: {
                NEW_DEVICE: 30,
                GEO_MISMATCH: 25,
                MULTIPLE_ACCOUNTS: 20,
                HIGH_RISK_IP: 25,
            },
        };
    }

    /**
     * =========================================================================
     * GENERATE DEVICE FINGERPRINT
     * =========================================================================
     */
    generateFingerprint(metadata) {
        const hash = crypto
            .createHash("sha256")
            .update(
                [
                    metadata.userAgent || "",
                    metadata.ip || "",
                    metadata.os || "",
                    metadata.browser || "",
                    metadata.deviceId || "",
                ].join("|")
            )
            .digest("hex");

        return hash;
    }

    /**
     * =========================================================================
     * REGISTER DEVICE
     * =========================================================================
     */
    async registerDevice(user, metadata) {
        const fingerprint = this.generateFingerprint(metadata);

        const existing = await DeviceFingerprint.findOne({
            userId: user._id,
            fingerprint,
        });

        if (existing) {
            return existing;
        }

        const newDevice = await DeviceFingerprint.create({
            fingerprint,
            userId: user._id,
            tenantId: user.tenantId,
            metadata,
            createdAt: new Date(),
            lastSeen: new Date(),
            reputationScore: 0,
        });

        return newDevice;
    }

    /**
     * =========================================================================
     * MONITOR DEVICE USAGE
     * =========================================================================
     */
    async monitorDevice(user, metadata) {
        const fingerprint = this.generateFingerprint(metadata);

        let device = await DeviceFingerprint.findOne({
            userId: user._id,
            fingerprint,
        });

        if (!device) {
            device = await this.registerDevice(user, metadata);
        }

        const riskScore = this.calculateRiskScore(user, device, metadata);
        const decision = this.getDecision(riskScore);

        // Update device record
        await DeviceFingerprint.updateOne(
            { fingerprint },
            { $set: { lastSeen: new Date(), reputationScore: riskScore } }
        );

        // Generate alert if needed
        if (decision !== "APPROVE") {
            await this.generateAlert(user, device, riskScore, decision);
        }

        return {
            fingerprint,
            riskScore,
            decision,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * RISK SCORING ENGINE
     * =========================================================================
     */
    calculateRiskScore(user, device, metadata) {
        let score = 0;

        // Rule 1: New device
        if (!device || !device.lastSeen) {
            score += this.config.reputationWeights.NEW_DEVICE;
        }

        // Rule 2: Geolocation mismatch
        if (metadata.geoMismatch) {
            score += this.config.reputationWeights.GEO_MISMATCH;
        }

        // Rule 3: Multiple accounts on same device
        if (metadata.multipleAccounts) {
            score += this.config.reputationWeights.MULTIPLE_ACCOUNTS;
        }

        // Rule 4: High‑risk IP
        if (metadata.highRiskIp) {
            score += this.config.reputationWeights.HIGH_RISK_IP;
        }

        return score;
    }

    /**
     * =========================================================================
     * DECISION ENGINE
     * =========================================================================
     */
    getDecision(score) {
        if (score >= this.config.thresholds.BLOCK) return "BLOCK";
        if (score >= this.config.thresholds.REVIEW) return "REVIEW";
        return "APPROVE";
    }

    /**
     * =========================================================================
     * ALERT GENERATION
     * =========================================================================
     */
    async generateAlert(user, device, riskScore, decision) {
        return RiskAlert.create({
            alertId: crypto.randomUUID(),
            userId: user._id,
            tenantId: user.tenantId,
            fingerprint: device.fingerprint,
            riskScore,
            decision,
            status: "OPEN",
            createdAt: new Date(),
        });
    }
}

module.exports = new DeviceFingerprintService();
