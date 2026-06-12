// controllers/admin.controller.js
// Production-ready dashboard summary for admin
//
// Features:
// - Tenant-scoped and date-range aware metrics
// - Aggregated totals, success/failure breakdown, daily timeseries, top users
// - Optional Redis caching support (if app.locals.redis is provided)
// - Robust input validation and error handling
// - Lightweight protection against expensive queries via max range limit

const Transaction = require("../models/Transaction");
const logger = require("../utils/logger");

const MAX_RANGE_DAYS = Number(process.env.ADMIN_MAX_RANGE_DAYS || 90);
const CACHE_TTL_SECONDS = Number(process.env.ADMIN_DASHBOARD_CACHE_TTL || 30);

/**
 * GET /admin/dashboard
 *
 * Query params:
 *  - startDate (ISO string) optional
 *  - endDate (ISO string) optional
 *  - tenantId optional (admin may scope to a tenant)
 *  - currency optional (e.g., UGX)
 *
 * Response:
 * {
 *   totalTransactions: Number,
 *   totalVolume: Number,
 *   byStatus: { PENDING: Number, SUCCESSFUL: Number, FAILED: Number },
 *   dailyVolumes: [{ date: "2026-06-01", total: Number }],
 *   topUsers: [{ userId: "...", count: Number, totalAmount: Number }],
 *   meta: { startDate, endDate, tenantId, currency, cached }
 * }
 */
exports.getDashboard = async (req, res, next) => {
  try {
    // Parse and validate query params
    const { startDate, endDate, tenantId, currency } = req.query;

    const now = new Date();
    const end = endDate ? new Date(endDate) : now;
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // default 30 days

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid startDate or endDate" });
    }

    if (start > end) {
      return res.status(400).json({ error: "startDate must be before endDate" });
    }

    const rangeDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
    if (rangeDays > MAX_RANGE_DAYS) {
      return res.status(400).json({ error: `Date range too large. Max ${MAX_RANGE_DAYS} days allowed.` });
    }

    // Build cache key if Redis is available
    const redis = req.app?.locals?.redis;
    const cacheKey = `admin:dashboard:${tenantId || "all"}:${currency || "any"}:${start.toISOString()}:${end.toISOString()}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const payload = JSON.parse(cached);
          payload.meta = payload.meta || {};
          payload.meta.cached = true;
          return res.json(payload);
        }
      } catch (err) {
        logger?.warn?.("Redis cache read failed for admin dashboard", { err: err?.message });
      }
    }

    // Build match stage (tenant, date range, optional currency)
    const match = {
      createdAt: { $gte: start, $lte: end },
    };
    if (tenantId) match.tenantId = tenantId;
    if (currency) match.currency = currency.toUpperCase();

    // Aggregation pipeline for totals and by-status counts
    const totalsPipeline = [
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ];

    const totalsAgg = await Transaction.aggregate(totalsPipeline).allowDiskUse(true);

    // Convert aggregation results into structured object
    const byStatus = {};
    let totalTransactions = 0;
    let totalVolume = 0;
    for (const row of totalsAgg) {
      const status = row._id || "UNKNOWN";
      byStatus[status] = row.count || 0;
      totalTransactions += row.count || 0;
      // row.totalAmount may be Decimal128; convert safely
      const amt = row.totalAmount == null ? 0 : Number(row.totalAmount);
      totalVolume += Number.isFinite(amt) ? amt : 0;
    }

    // Daily volumes timeseries (one entry per day in range)
    const dailyPipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const dailyAgg = await Transaction.aggregate(dailyPipeline).allowDiskUse(true);

    // Top users by volume and count
    const topUsersPipeline = [
      { $match: match },
      {
        $group: {
          _id: "$user",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
    ];
    const topUsersAgg = await Transaction.aggregate(topUsersPipeline).allowDiskUse(true);

    const dailyVolumes = dailyAgg.map((d) => ({
      date: d._id,
      total: d.total == null ? 0 : Number(d.total),
      count: d.count || 0,
    }));

    const topUsers = topUsersAgg.map((u) => ({
      userId: u._id,
      count: u.count || 0,
      totalAmount: u.totalAmount == null ? 0 : Number(u.totalAmount),
    }));

    const payload = {
      totalTransactions,
      totalVolume,
      byStatus,
      dailyVolumes,
      topUsers,
      meta: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        tenantId: tenantId || null,
        currency: currency || null,
        cached: false,
      },
    };

    // Cache the result if Redis is available
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(payload), { EX: CACHE_TTL_SECONDS });
      } catch (err) {
        logger?.warn?.("Redis cache write failed for admin dashboard", { err: err?.message });
      }
    }

    return res.json(payload);
  } catch (err) {
    logger?.error?.("Failed to compute admin dashboard", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: "Failed to compute dashboard" });
  }
};
