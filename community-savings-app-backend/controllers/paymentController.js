/**
 * Payment Controller
 * Handles payment intent creation, webhook processing, and transaction queries
 * Validates input, calls PaymentService, returns appropriate HTTP responses
 * Supports multiple providers: Stripe, Mobile Money, etc.
 */

const logger = require('../utils/logger');

/**
 * POST /api/payments/intents
 * Create a new payment intent
 * Body: { amount, currency, provider, description, customerEmail, metadata }
 */
async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = 'usd', provider = 'stripe', description, customerEmail, metadata = {} } = req.body;
    const userId = req.user._id;

    // Input validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Must be greater than 0.',
      });
    }

    if (!provider) {
      return res.status(400).json({
        error: 'Provider is required (stripe, mobileMoney, etc)',
      });
    }

    // Generate idempotency key from request
    const idempotencyKey = req.headers['idempotency-key'] || `${userId}-${Date.now()}`;

    logger.info('[PaymentController] Creating payment intent', {
      userId,
      amount,
      provider,
      idempotencyKey,
    });

    const paymentIntent = await req.app.locals.paymentService.createPaymentIntent({
      userId,
      amount,
      currency,
      provider,
      description,
      customerEmail: customerEmail || req.user.email,
      metadata,
      idempotencyKey,
    });

    // Return response with client data
    return res.status(201).json({
      success: true,
      data: {
        paymentIntentId: paymentIntent._id,
        provider: paymentIntent.provider,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientData: paymentIntent.clientData,
        createdAt: paymentIntent.createdAt,
      },
    });
  } catch (error) {
    logger.error('[PaymentController] Error creating payment intent', {
      error: error.message,
      userId: req.user?._id,
    });

    return res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message,
    });
  }
}

/**
 * GET /api/payments/intents/:id
 * Get payment intent status
 * Query: ?refresh=true (optional, to sync with provider)
 */
async function getPaymentIntent(req, res) {
  try {
    const { id } = req.params;
    const { refresh } = req.query;
    const userId = req.user._id;

    logger.info('[PaymentController] Fetching payment intent', {
      paymentIntentId: id,
      userId,
      refresh: refresh === 'true',
    });

    const paymentIntent = await req.app.locals.paymentService.getPaymentIntent(
      id,
      refresh === 'true'
    );

    // Verify user owns this intent
    if (paymentIntent.user?.toString() !== userId.toString()) {
      return res.status(403).json({
        error: 'Access denied. You do not own this payment intent.',
      });
    }

    return res.status(200).json({
      success: true,
      data: paymentIntent,
    });
  } catch (error) {
    logger.error('[PaymentController] Error getting payment intent', {
      error: error.message,
      paymentIntentId: req.params.id,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    return res.status(500).json({
      error: 'Failed to retrieve payment intent',
      message: error.message,
    });
  }
}

/**
 * POST /api/payments/webhooks/:provider
 * Handle webhook events from payment provider
 * Signature verification must pass before processing
 * Body: Raw webhook payload (raw body middleware required)
 */
async function handleWebhook(req, res) {
  try {
    const { provider } = req.params;
    const rawBody = req.rawBody; // Must be provided by middleware
    const headers = req.headers;

    logger.info('[PaymentController] Received webhook', {
      provider,
      eventType: req.body?.type,
    });

    // Verify webhook signature
    const adapter = req.app.locals.paymentService.providers[provider];
    if (!adapter) {
      logger.warn('[PaymentController] Unknown provider in webhook', { provider });
      return res.status(400).json({ error: 'Unknown provider' });
    }

    const isValid = adapter.verifyWebhook(rawBody, headers);
    if (!isValid) {
      logger.warn('[PaymentController] Webhook signature verification failed', {
        provider,
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Process webhook event
    const result = await req.app.locals.paymentService.handleProviderEvent(provider, req.body);

    if (!result.success) {
      logger.warn('[PaymentController] Webhook processing failed', {
        provider,
        reason: result.reason,
      });
      // Return 200 to acknowledge receipt even if processing failed
      // Provider will retry on other errors
      return res.status(200).json({
        acknowledged: true,
        processed: false,
        reason: result.reason,
      });
    }

    logger.info('[PaymentController] Webhook processed successfully', {
      provider,
      paymentIntentId: result.paymentIntentId,
      status: result.status,
    });

    return res.status(200).json({
      acknowledged: true,
      processed: true,
      paymentIntentId: result.paymentIntentId,
      status: result.status,
    });
  } catch (error) {
    logger.error('[PaymentController] Error processing webhook', {
      error: error.message,
      provider: req.params.provider,
    });

    // Return 200 to prevent provider from resending
    return res.status(200).json({
      acknowledged: true,
      processed: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/payments/:id/cancel
 * Cancel a payment intent
 */
async function cancelPaymentIntent(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    logger.info('[PaymentController] Cancelling payment intent', {
      paymentIntentId: id,
      userId,
    });

    const paymentIntent = await req.app.locals.paymentService.cancelPaymentIntent(id);

    // Verify ownership
    if (paymentIntent.user.toString() !== userId.toString()) {
      return res.status(403).json({
        error: 'Access denied. You do not own this payment intent.',
      });
    }

    // Check if cancellable (can't cancel if already completed)
    if (['succeeded', 'failed'].includes(paymentIntent.status)) {
      return res.status(400).json({
        error: `Cannot cancel payment intent with status '${paymentIntent.status}'`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        paymentIntentId: id,
        status: paymentIntent.status,
        message: 'Payment intent cancelled',
      },
    });
  } catch (error) {
    logger.error('[PaymentController] Error cancelling payment intent', {
      error: error.message,
      paymentIntentId: req.params.id,
    });

    return res.status(500).json({
      error: 'Failed to cancel payment intent',
      message: error.message,
    });
  }
}

/**
 * GET /api/payments/transactions
 * List user transactions
 * Query: ?limit=20&skip=0&status=completed&startDate=2024-01-01&endDate=2024-12-31
 */
async function listTransactions(req, res) {
  try {
    const userId = req.user._id;
    const { limit = '20', skip = '0', status, startDate, endDate } = req.query;

    logger.info('[PaymentController] Listing transactions', {
      userId,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });

    const result = await req.app.locals.paymentService.listTransactions(userId, {
      limit: Math.min(parseInt(limit), 100), // Max 100 per page
      skip: parseInt(skip),
      status: status || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    return res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: {
        total: result.total,
        limit: result.limit,
        skip: result.skip,
        pages: result.pages,
        currentPage: result.currentPage,
      },
    });
  } catch (error) {
    logger.error('[PaymentController] Error listing transactions', {
      error: error.message,
      userId: req.user._id,
    });

    return res.status(500).json({
      error: 'Failed to retrieve transactions',
      message: error.message,
    });
  }
}

/**
 * GET /api/payments/analytics/summary
 * Admin endpoint: Payment analytics summary
 */
async function getPaymentAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user._id;

    logger.info('[PaymentController] Fetching payment analytics', { userId });

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const Transaction = require('../models/Transaction');

    const [totalTransactions, successfulPayments, totalAmount, averageAmount] = await Promise.all([
      Transaction.countDocuments(query),
      Transaction.countDocuments({ ...query, status: 'completed', type: 'credit' }),
      Transaction.aggregate([
        { $match: { ...query, type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...query, type: 'credit' } },
        { $group: { _id: null, avg: { $avg: '$amount' } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalTransactions,
        successfulPayments,
        totalAmount: totalAmount[0]?.total || 0,
        averageAmount: averageAmount[0]?.avg || 0,
        successRate: totalTransactions > 0 ? ((successfulPayments / totalTransactions) * 100).toFixed(2) + '%' : '0%',
      },
    });
  } catch (error) {
    logger.error('[PaymentController] Error getting payment analytics', {
      error: error.message,
    });

    return res.status(500).json({
      error: 'Failed to retrieve payment analytics',
      message: error.message,
    });
  }
}

module.exports = {
  createPaymentIntent,
  getPaymentIntent,
  handleWebhook,
  cancelPaymentIntent,
  listTransactions,
  getPaymentAnalytics,
};
