const Queue = require('bull');
const redis = require('redis');
const logger = require('../middleware/logging');

// Initialize queues
const paymentRetryQueue = new Queue('payment-retries', process.env.REDIS_URL || 'redis://localhost:6379');
const emailQueue = new Queue('emails', process.env.REDIS_URL || 'redis://localhost:6379');
const overdueLoanQueue = new Queue('overdue-loans', process.env.REDIS_URL || 'redis://localhost:6379');
const notificationQueue = new Queue('notifications', process.env.REDIS_URL || 'redis://localhost:6379');

// Payment retry processor
paymentRetryQueue.process(async (job) => {
  const { paymentIntentId, retryCount = 0 } = job.data;
  const maxRetries = 3;
  const backoffMs = 1000 * Math.pow(2, retryCount);

  try {
    const PaymentIntent = require('../models/PaymentIntent');
    const pi = await PaymentIntent.findById(paymentIntentId);
    if (!pi) throw new Error('Payment intent not found');

    // Retry payment through provider
    // TODO: implement provider retry logic
    pi.attempts = retryCount + 1;
    await pi.save();

    logger.info('Payment retry processed', { paymentIntentId, retry: retryCount + 1 });
  } catch (err) {
    logger.error('Payment retry failed', { paymentIntentId, error: err.message });
    if (retryCount < maxRetries) {
      throw err; // Bull will reschedule with exponential backoff
    }
  }
});

// Email queue processor
emailQueue.process(async (job) => {
  const { to, subject, html, text } = job.data;
  const EmailService = require('./emailService');

  try {
    await EmailService.send({ to, subject, html, text });
    logger.info('Email sent', { to, subject });
  } catch (err) {
    logger.error('Email failed', { to, error: err.message });
    throw err;
  }
});

// Overdue loan detection processor
overdueLoanQueue.process(async (job) => {
  const Loan = require('../models/Loan');
  const LoanRepaymentSchedule = require('../models/LoanRepaymentSchedule');
  const LoanWorkflowService = require('./loanWorkflowService');

  try {
    const loans = await Loan.find({ status: 'active' });
    for (const loan of loans) {
      const schedule = await LoanRepaymentSchedule.findOne({ loan: loan._id });
      if (schedule && schedule.nextDueDate < new Date()) {
        await LoanWorkflowService.changeLoanStatus(loan._id, 'overdue', 'system', 'Past due date');
        await notificationQueue.add({ type: 'loan-overdue', loanId: loan._id });
      }
    }
    logger.info('Overdue detection completed');
  } catch (err) {
    logger.error('Overdue detection failed', { error: err.message });
  }
});

// Notification processor
notificationQueue.process(async (job) => {
  const { type, loanId, userId } = job.data;

  try {
    if (type === 'loan-overdue') {
      const Loan = require('../models/Loan');
      const User = require('../models/User');
      const loan = await Loan.findById(loanId);
      const user = await User.findById(loan.user);
      // Queue email notification
      await emailQueue.add({ to: user.email, subject: 'Loan Payment Overdue', text: `Your loan is overdue.` });
    }
    logger.info('Notification sent', { type, loanId });
  } catch (err) {
    logger.error('Notification failed', { error: err.message });
  }
});

// Event listeners for monitoring
paymentRetryQueue.on('failed', (job, err) => {
  logger.error('Payment retry job failed', { jobId: job.id, error: err.message });
});

emailQueue.on('failed', (job, err) => {
  logger.error('Email job failed', { jobId: job.id, error: err.message });
});

// Export queues for use in services
module.exports = {
  paymentRetryQueue,
  emailQueue,
  overdueLoanQueue,
  notificationQueue
};
