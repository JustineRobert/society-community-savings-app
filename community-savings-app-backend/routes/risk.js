// routes/risk.js
'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const limiter = require('../middleware/limiter');
const { authenticate, requireRole } = require('../middleware/auth'); // ✅ import both
const validate = require('../middleware/validate');

const { runCreditScore, runFraudCheck } = require('../controllers/riskController');

/**
 * POST /api/risk/score
 * Accessible to any authenticated user (regular users)
 */
router.post(
  '/score',
  limiter,
  authenticate,
  requireRole('USER', 'ADMIN'), // ✅ allow both USER and ADMIN roles
  validate([
    body('features').exists().withMessage('features is required').isObject(),
    body('features.contributions').optional().isNumeric(),
    body('features.loanRepaymentsOnTime').optional().isBoolean(),
    body('features.missedPayments').optional().isNumeric(),
    body('features.momoInflows').optional().isNumeric(),
    body('features.momoOutflows').optional().isNumeric(),
    body('features.savingsConsistency').optional().isBoolean(),
    body('features.groupParticipation').optional().isBoolean(),
    body('features.guarantorStrength').optional().isString()
  ]),
  runCreditScore
);

/**
 * POST /api/risk/fraud-check
 * Restricted to admins only
 */
router.post(
  '/fraud-check',
  limiter,
  authenticate,
  requireRole('ADMIN'), // ✅ only admins can access
  validate([
    body('transaction').exists().withMessage('transaction is required').isObject(),
    body('transaction._id').exists().withMessage('_id is required'),
    body('transaction.type').exists().withMessage('type is required'),
    body('transaction.amount').exists().withMessage('amount is required').isNumeric()
  ]),
  runFraudCheck
);

module.exports = router;
