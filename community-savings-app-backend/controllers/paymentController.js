// controllers/paymentController.js
// ============================================================================
// Payment Controller - Handle Mobile Money Transactions
// - Manage payment initiation, status checks, and refunds
// - Secure transaction processing with audit logging
// ============================================================================

const asyncHandler = require('../utils/asyncHandler');
const mobileMoneyService = require('../services/mobileMoneyService');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * POST /api/payments/initiate
 * Initiate a new mobile money payment
 */
const initiatePayment = asyncHandler(async (req, res) => {
  const { phoneNumber, amount, currency, provider, groupId, contributionId, description } =
    req.body;

  // Validation
  if (!phoneNumber || !amount || !provider) {
    return res.status(400).json({
      message: 'Missing required fields: phoneNumber, amount, provider',
    });
  }

  if (!['MTN_MOMO', 'AIRTEL_MONEY'].includes(provider)) {
    return res.status(400).json({
      message: 'Unsupported payment provider. Use MTN_MOMO or AIRTEL_MONEY',
    });
  }

  if (amount < 100 || amount > 500000) {
    return res.status(400).json({
      message: 'Payment amount must be between 100 and 500,000',
    });
  }

  try {
    // Create transaction ID and idempotency key
    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const idempotencyKey = req.headers['idempotency-key'] || transactionId;

    // Check for duplicate request (idempotency)
    const existingPayment = await Payment.findOne({
      userId: req.user._id,
      idempotencyKey,
      status: { $in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
    });

    if (existingPayment) {
      logger.warn('Duplicate payment request detected', {
        userId: req.user._id,
        idempotencyKey,
      });
      return res.status(409).json({
        message: 'Duplicate payment request',
        transactionId: existingPayment.transactionId,
        status: existingPayment.status,
      });
    }

    // Prepare metadata
    const metadata = {
      description: description || 'Community Savings Contribution',
      deviceId: req.headers['x-device-id'],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    // Call appropriate provider service
    let paymentData;

    if (provider === 'MTN_MOMO') {
      paymentData = await mobileMoneyService.initiateMTNPayment(
        phoneNumber,
        amount,
        currency,
        idempotencyKey,
        metadata
      );
    } else if (provider === 'AIRTEL_MONEY') {
      paymentData = await mobileMoneyService.initiateAirtelPayment(
        phoneNumber,
        amount,
        currency,
        idempotencyKey,
        metadata
      );
    }

    // Store payment record in database
    const payment = new Payment({
      transactionId: paymentData.transactionId,
      userId: req.user._id,
      groupId,
      contributionId,
      amount,
      currency,
      provider,
      phoneNumber,
      status: 'PENDING',
      providerReference: paymentData.providerReference,
      metadata,
      idempotencyKey,
    });

    await payment.save();

    logger.info('Payment initiated successfully', {
      transactionId: payment.transactionId,
      provider,
      amount,
      userId: req.user._id,
    });

    res.status(201).json({
      message: 'Payment initiated successfully',
      transactionId: payment.transactionId,
      status: payment.status,
      provider,
      amount,
      currency,
      phoneNumber: mobileMoneyService.maskPhoneNumber(phoneNumber),
      providerReference: paymentData.providerReference,
    });
  } catch (error) {
    logger.error('Payment initiation error', {
      error: error.message,
      provider,
      userId: req.user._id,
      amount,
    });

    res.status(400).json({
      message: error.message || 'Failed to initiate payment',
    });
  }
});

/**
 * POST /api/payments/:transactionId/status
 * Check payment status
 */
const checkPaymentStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  try {
    // Get payment record
    const payment = await Payment.findOne({ transactionId });

    if (!payment) {
      return res.status(404).json({
        message: 'Payment not found',
      });
    }

    // Verify ownership
    if (payment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Unauthorized to access this payment',
      });
    }

    // If already completed or failed, return cached status
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(payment.status)) {
      return res.status(200).json({
        transactionId: payment.transactionId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        confirmedAt: payment.confirmedAt,
        failedAt: payment.failedAt,
        error: payment.error,
      });
    }

    // Check status with provider
    let providerStatus;

    try {
      if (payment.provider === 'MTN_MOMO') {
        providerStatus = await mobileMoneyService.checkMTNTransactionStatus(
          payment.providerReference
        );
      } else if (payment.provider === 'AIRTEL_MONEY') {
        providerStatus = await mobileMoneyService.checkAirtelTransactionStatus(
          payment.providerReference
        );
      }

      // Update payment status if changed
      if (providerStatus.status === 'COMPLETED' && payment.status !== 'COMPLETED') {
        await payment.markCompleted(payment.providerReference, providerStatus.providerStatus);
        logger.info('Payment confirmed', {
          transactionId,
          provider: payment.provider,
        });
      } else if (providerStatus.status === 'FAILED' && payment.status !== 'FAILED') {
        await payment.markFailed(
          'PROVIDER_FAILED',
          providerStatus.reason || 'Payment failed at provider',
          {
            providerStatus: providerStatus.providerStatus,
          }
        );
      }
    } catch (checkError) {
      logger.warn('Could not verify payment with provider, using cached status', {
        transactionId,
        error: checkError.message,
      });
    }

    res.status(200).json({
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      phoneNumber: mobileMoneyService.maskPhoneNumber(payment.phoneNumber),
      initiatedAt: payment.initiatedAt,
      confirmedAt: payment.confirmedAt,
      failedAt: payment.failedAt,
      error: payment.error,
      providerReference: payment.providerReference,
    });
  } catch (error) {
    logger.error('Error checking payment status', {
      transactionId,
      error: error.message,
    });

    res.status(500).json({
      message: 'Failed to check payment status',
    });
  }
});

/**
 * POST /api/payments/:transactionId/refund
 * Request refund for a payment
 */
const requestRefund = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { refundAmount, refundReason } = req.body;

  try {
    const payment = await Payment.findOne({ transactionId });

    if (!payment) {
      return res.status(404).json({
        message: 'Payment not found',
      });
    }

    // Verify ownership
    if (payment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Unauthorized to request refund',
      });
    }

    if (payment.status !== 'COMPLETED') {
      return res.status(400).json({
        message: 'Only completed payments can be refunded',
      });
    }

    const refundAmt = refundAmount || payment.amount;

    if (refundAmt > payment.amount) {
      return res.status(400).json({
        message: 'Refund amount cannot exceed original payment',
      });
    }

    // Process refund with provider
    let refundResult;

    try {
      if (payment.provider === 'MTN_MOMO') {
        refundResult = await mobileMoneyService.refundMTNPayment(
          transactionId,
          refundAmt,
          refundReason
        );
      } else if (payment.provider === 'AIRTEL_MONEY') {
        refundResult = await mobileMoneyService.refundAirtelPayment(
          transactionId,
          refundAmt,
          refundReason
        );
      }
    } catch (refundError) {
      logger.error('Provider refund failed', {
        transactionId,
        error: refundError.message,
      });

      return res.status(400).json({
        message: `Refund failed: ${refundError.message}`,
      });
    }

    // Update payment record
    await payment.refund(refundAmt, refundReason);

    logger.info('Refund processed', {
      transactionId,
      refundAmount: refundAmt,
      provider: payment.provider,
      userId: req.user._id,
    });

    res.status(200).json({
      message: 'Refund processed successfully',
      transactionId,
      refundId: refundResult.refundId,
      refundAmount: refundAmt,
      status: 'REFUNDED',
      refundReason,
    });
  } catch (error) {
    logger.error('Refund request error', {
      transactionId,
      error: error.message,
    });

    res.status(500).json({
      message: 'Failed to process refund',
    });
  }
});

/**
 * GET /api/payments
 * Get user's payment history
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { status, provider, skip = 0, limit = 20 } = req.query;

  const filter = { userId: req.user._id };

  if (status) {
    filter.status = status;
  }

  if (provider) {
    filter.provider = provider;
  }

  const payments = await Payment.find(filter)
    .select('-metadata.ipAddress -metadata.userAgent')
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(filter);

  // Mask phone numbers before sending
  const maskedPayments = payments.map((payment) => {
    const obj = payment.toObject();
    obj.phoneNumber = mobileMoneyService.maskPhoneNumber(obj.phoneNumber);
    return obj;
  });

  res.status(200).json({
    message: 'Payment history retrieved',
    data: maskedPayments,
    pagination: {
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
      hasMore: parseInt(skip) + parseInt(limit) < total,
    },
  });
});

/**
 * GET /api/payments/:transactionId
 * Get payment details
 */
const getPaymentDetails = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  const payment = await Payment.findOne({ transactionId });

  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
    });
  }

  // Verify ownership
  if (payment.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      message: 'Unauthorized to access this payment',
    });
  }

  const obj = payment.toObject();
  obj.phoneNumber = mobileMoneyService.maskPhoneNumber(obj.phoneNumber);

  res.status(200).json({
    message: 'Payment details retrieved',
    data: obj,
  });
});

module.exports = {
  initiatePayment,
  checkPaymentStatus,
  requestRefund,
  getPaymentHistory,
  getPaymentDetails,
};
