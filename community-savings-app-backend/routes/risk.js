// routes/risk.js
'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const riskController = require('../controllers/riskController');
const auth = require('../middleware/auth');

// Lightweight rate limiter for risk endpoints
const limiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20,             // max 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Validation middleware wrapper
 */
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  return next();
};

/**
 * POST /api/risk/score
 */
router.post(
  '/score',
  limiter,
  auth,
  validate([
    body('features').exists().withMessage('features is required').isObject(),
    body('features.contributions').optional().isNumeric(),
    body('features.loanRepaymentHistory').optional().isBoolean(),
    body('features.missedPayments').optional().isNumeric(),
    body('features.momoInflows').optional().isNumeric(),
    body('features.momoOutflows').optional().isNumeric(),
    body('features.savingsConsistency').optional().isBoolean(),
    body('features.groupParticipation').optional().isBoolean(),
    body('features.guarantorStrength').optional().isString()
  ]),
  riskController.runCreditScore
);

/**
 * POST /api/risk/fraud-check
 */
router.post(
  '/fraud-check',
  limiter,
  auth,
  validate([
    body('transaction').exists().withMessage('transaction is required').isObject(),
    body('transaction._id').exists().withMessage('transaction._id is required').isString(),
    body('transaction.type').exists().withMessage('transaction.type is required').isString(),
    body('transaction.amount').exists().withMessage('transaction.amount is required').isNumeric(),
    body('transaction.frequency').optional().isNumeric(),
    body('transaction.newDevice').optional().isBoolean(),
    body('transaction.locationMismatch').optional().isBoolean()
  ]),
  riskController.runFraudCheck
);

/**
 * GET /api/risk/profile/:userId
 */
router.get(
  '/profile/:userId',
  limiter,
  auth,
  validate([param('userId').exists().isString()]),
  riskController.getRiskProfile
);

/**
 * POST /api/risk/compliance/kyc
 */
router.post(
  '/compliance/kyc',
  limiter,
  auth,
  validate([
    body('nationalId').exists().withMessage('nationalId is required').isString(),
    body('phone').exists().withMessage('phone is required').isString(),
    body('address').exists().withMessage('address is required').isString(),
    body('userId').optional().isString()
  ]),
  riskController.kycVerification
);

/**
 * GET /api/risk/compliance/report/:id
 */
router.get(
  '/compliance/report/:id',
  limiter,
  auth,
  validate([param('id').exists().isString()]),
  riskController.getComplianceReport
);

module.exports = router;
