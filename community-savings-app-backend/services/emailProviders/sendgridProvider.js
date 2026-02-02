// services/emailProviders/sendgridProvider.js
// ============================================================================
// SendGrid Email Provider
// Production-grade email delivery via SendGrid API
// ============================================================================

const logger = require('../../utils/logger');

// Lazy-load SendGrid to avoid requiring it if not in use
let sgMail;
try {
  sgMail = require('@sendgrid/mail');
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
} catch (err) {
  logger.warn('[EmailProvider:SendGrid] @sendgrid/mail not installed. Install with: npm install @sendgrid/mail');
}

/**
 * Send email via SendGrid
 */
async function send({ to, from, fromName, subject, html, text }) {
  if (!sgMail) {
    throw new Error('SendGrid not configured. Install @sendgrid/mail and set SENDGRID_API_KEY');
  }

  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY environment variable not set');
  }

  try {
    const result = await sgMail.send({
      to,
      from: `${fromName} <${from}>`,
      subject,
      html,
      text,
      replyTo: from,
      // Additional options
      trackingSettings: {
        clickTracking: { enabled: true },
        openTracking: { enabled: true },
        subscriptionTracking: { enabled: false },
      },
    });

    logger.debug('[EmailProvider:SendGrid] Email sent successfully', {
      to,
      subject,
      messageId: result[0].headers['x-message-id'],
    });

    return {
      messageId: result[0].headers['x-message-id'],
      status: 'sent',
      provider: 'sendgrid',
    };
  } catch (error) {
    logger.error('[EmailProvider:SendGrid] Failed to send email', {
      to,
      subject,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { send };
