/**
 * ============================================================================
 * TITech Community Capital LTD
 * Risk Analytics Service
 * ============================================================================
 * Enterprise Risk Analytics Engine
 * ============================================================================
 * Features
 * - Portfolio risk aggregation
 * - Fraud trend analysis
 * - Credit risk distribution
 * - Sanctions screening metrics
 * - Case management analytics
 * - Real‑time dashboards
 * - Historical reporting
 * - Tenant‑aware multi‑domain analytics
 * ============================================================================
 */

const TransactionLog = require("../../models/TransactionLog");
const RiskAlert = require("../../models/RiskAlert");
const Case = require("../../models/Case");
const RiskProfile = require("../../models/RiskProfile");

class RiskAnalyticsService {
    /**
     * =========================================================================
     * PORTFOLIO RISK AGGREGATION
     * =========================================================================
     */
    async getPortfolioRisk(tenantId) {
        const profiles = await RiskProfile.find({ tenantId });

        const distribution = {
            CLEAR: 0,
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            CRITICAL: 0,
        };

        profiles.forEach((profile) => {
            distribution[profile.riskLevel] =
                (distribution[profile.riskLevel] || 0) + 1;
        });

        return {
            tenantId,
            totalProfiles: profiles.length,
            distribution,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * FRAUD TREND ANALYSIS
     * =========================================================================
     */
    async getFraudTrends(tenantId, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const alerts = await RiskAlert.find({
            tenantId,
            createdAt: { $gte: since },
        });

        const dailyCounts = {};

        alerts.forEach((alert) => {
            const day = alert.createdAt.toISOString().split("T")[0];
            dailyCounts[day] = (dailyCounts[day] || 0) + 1;
        });

        return {
            tenantId,
            days,
            trend: dailyCounts,
            totalAlerts: alerts.length,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * CREDIT RISK DISTRIBUTION
     * =========================================================================
     */
    async getCreditRiskDistribution(tenantId) {
        const profiles = await RiskProfile.find({ tenantId });

        const buckets = {
            "300-499": 0,
            "500-599": 0,
            "600-699": 0,
            "700-799": 0,
            "800-850": 0,
        };

        profiles.forEach((profile) => {
            const score = profile.creditScore || 0;
            if (score < 500) buckets["300-499"]++;
            else if (score < 600) buckets["500-599"]++;
            else if (score < 700) buckets["600-699"]++;
            else if (score < 800) buckets["700-799"]++;
            else buckets["800-850"]++;
        });

        return {
            tenantId,
            buckets,
            totalProfiles: profiles.length,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * SANCTIONS SCREENING METRICS
     * =========================================================================
     */
    async getSanctionsMetrics(tenantId, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const logs = await TransactionLog.find({
            tenantId,
            createdAt: { $gte: since },
        });

        const metrics = {
            totalScreenings: logs.length,
            blocked: 0,
            reviewed: 0,
            approved: 0,
        };

        logs.forEach((log) => {
            if (log.decision === "BLOCK") metrics.blocked++;
            else if (log.decision === "REVIEW") metrics.reviewed++;
            else metrics.approved++;
        });

        return {
            tenantId,
            days,
            metrics,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * CASE MANAGEMENT ANALYTICS
     * =========================================================================
     */
    async getCaseAnalytics(tenantId) {
        const cases = await Case.find({ tenantId });

        const statusCounts = {
            OPEN: 0,
            UNDER_REVIEW: 0,
            ESCALATED: 0,
            CLOSED: 0,
        };

        cases.forEach((c) => {
            statusCounts[c.status] =
                (statusCounts[c.status] || 0) + 1;
        });

        return {
            tenantId,
            totalCases: cases.length,
            statusCounts,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * COMBINED DASHBOARD DATA
     * =========================================================================
     */
    async getDashboardData(tenantId) {
        const [portfolio, fraud, credit, sanctions, cases] =
            await Promise.all([
                this.getPortfolioRisk(tenantId),
                this.getFraudTrends(tenantId),
                this.getCreditRiskDistribution(tenantId),
                this.getSanctionsMetrics(tenantId),
                this.getCaseAnalytics(tenantId),
            ]);

        return {
            tenantId,
            portfolio,
            fraud,
            credit,
            sanctions,
            cases,
            timestamp: new Date().toISOString(),
        };
    }
}

module.exports = new RiskAnalyticsService();
