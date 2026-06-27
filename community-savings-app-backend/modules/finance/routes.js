// ============================================================================
// TITech Community Capital – Finance Routes
// File: backend/modules/finance/routes.js
// Production-grade
// ============================================================================

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const asyncHandler = require('../../../utils/asyncHandler');
const { repay } = require('./controllers/repaymentController');
const { requireAuth } = require('../../../middleware/auth');
const { requireTenant } = require('../../../middleware/tenant');

const router = express.Router();

/**
 * @openapi
 * /api/finance/repay:
 *   post:
 *     summary: Process a loan repayment (idempotent)
 *     tags:
 *       - Finance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique idempotency key for the payment
 *       - in: header
 *         name: X-Request-Id
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional request correlation id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanId
 *               - walletId
 *               - amount
 *             properties:
 *               loanId:
 *                 type: string
 *               walletId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 format: double
 *               currency:
 *                 type: string
 *                 description: 3-letter ISO currency code
 *               debitAccountCode:
 *                 type: string
 *               creditAccountCode:
 *                 type: string
 *               description:
 *                 type: string
 *               provider:
 *                 type: string
 *               momoTransactionId:
 *                 type: string
 *               metadata:
 *                 type: object
 *               paymentId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Repayment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: object
 *       '400':
 *         description: Validation error or missing idempotency key
 *       '401':
 *         description: Authentication required
 *       '402':
 *         description: Payment required / insufficient funds
 *       '409':
 *         description: Conflict (idempotent duplicate)
 *       '429':
 *         description: Too many requests
 *       '500':
 *         description: Internal server error
 */

/**
 * Rate limiter for sensitive endpoints (tunable)
 * - short window to protect against brute force / replay attempts
 */
const repayLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // allow 10 requests per minute per IP (adjust to your needs)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

/**
 * Joi schema for repay payload
 */
const repaySchema = Joi.object({
  loanId: Joi.string().required(),
  walletId: Joi.string().required(),
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().length(3).uppercase().optional(),
  debitAccountCode: Joi.string().optional(),
  creditAccountCode: Joi.string().optional(),
  description: Joi.string().max(1024).optional(),
  provider: Joi.string().optional(),
  momoTransactionId: Joi.string().optional(),
  metadata: Joi.object().optional(),
  paymentId: Joi.string().optional(), // fallback if client sends in body
});

/**
 * Middleware: require idempotency key (header or body)
 */
function requireIdempotencyKey(req, res, next) {
  const headerKey = (req.headers['idempotency-key'] || '').toString().trim();
  const bodyKey = (req.body && req.body.paymentId) ? String(req.body.paymentId).trim() : '';
  if (!headerKey && !bodyKey) {
    return res.status(400).json({ success: false, error: 'Idempotency key required (Idempotency-Key header or paymentId in body)' });
  }
  // normalize into req.idempotencyKey for downstream use
  req.idempotencyKey = headerKey || bodyKey;
  next();
}

/**
 * Inline validation middleware (fallback if shared validateBody is not available)
 */
function validateRepayBody(req, res, next) {
  const { error, value } = repaySchema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ success: false, error: error.details.map(d => d.message).join(', ') });
  req.validatedBody = value;
  next();
}

/**
 * Route: POST /repay
 *
 * Middlewares:
 *  - requireAuth: ensures user is authenticated
 *  - requireTenant: ensures tenant context is set
 *  - repayLimiter: rate limiting for abuse protection
 *  - requireIdempotencyKey: enforces idempotency key presence
 *  - validateRepayBody: validates and sanitizes request body
 *  - asyncHandler(repay): catches async errors and forwards to error handler
 */
router.post(
  '/repay',
  requireAuth,
  requireTenant,
  repayLimiter,
  requireIdempotencyKey,
  validateRepayBody,
  asyncHandler(async (req, res, next) => {
    const body = req.validatedBody;
    const tenantId = req.tenant.id;
    const paymentId = req.idempotencyKey;

    const opts = {
      currency: body.currency || 'UGX',
      debitAccountCode: body.debitAccountCode,
      creditAccountCode: body.creditAccountCode,
      description: body.description,
      requestId: req.headers['x-request-id'] || null,
      provider: body.provider || null,
      momoTransactionId: body.momoTransactionId || null,
      metadata: body.metadata || {},
      createdBy: req.user.id,
    };

    const result = await require('../services/repaymentService').processRepayment({
      tenantId,
      loanId: body.loanId,
      payerWalletId: body.walletId,
      amount: body.amount,
      paymentId,
      opts,
    });

    return res.status(200).json({ success: true, result });
  })
);

module.exports = router;
