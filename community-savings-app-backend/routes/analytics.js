const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const AnalyticsService = require('../services/analyticsService');

// Middleware: admin only
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Unauthorized' });
}

// GET /api/admin/analytics/payments?from=&to=
router.get('/payments', requireAdmin, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const fromDate = new Date(from || Date.now() - 30 * 24 * 3600 * 1000);
  const toDate = new Date(to || Date.now());
  const metrics = await AnalyticsService.getPaymentMetrics(fromDate, toDate);
  res.json(metrics);
}));

// GET /api/admin/analytics/users?days=30
router.get('/users', requireAdmin, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const metrics = await AnalyticsService.getUserMetrics(parseInt(days));
  res.json(metrics);
}));

// GET /api/admin/analytics/loans
router.get('/loans', requireAdmin, asyncHandler(async (req, res) => {
  const metrics = await AnalyticsService.getLoanMetrics();
  res.json(metrics);
}));

// GET /api/admin/analytics/referrals
router.get('/referrals', requireAdmin, asyncHandler(async (req, res) => {
  const metrics = await AnalyticsService.getReferralMetrics();
  res.json(metrics);
}));

// GET /api/admin/analytics/dashboard (composite)
router.get('/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  const [payments, users, loans, referrals] = await Promise.all([
    AnalyticsService.getPaymentMetrics(new Date(Date.now() - 30 * 24 * 3600 * 1000), new Date()),
    AnalyticsService.getUserMetrics(30),
    AnalyticsService.getLoanMetrics(),
    AnalyticsService.getReferralMetrics()
  ]);
  res.json({ payments, users, loans, referrals });
}));

module.exports = router;
