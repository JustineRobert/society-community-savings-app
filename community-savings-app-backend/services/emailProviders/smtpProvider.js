// services/emailProviders/smtpProvider.js
// ============================================================================
// SMTP Email Provider
// Generic SMTP support (Gmail, Office365, custom SMTP servers, etc.)
// ============================================================================

const logger = require('../../utils/logger');
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  // Validate configuration
  if (!config.host || !config.auth.user || !config.auth.pass) {
    throw new Error('SMTP configuration incomplete. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
  }

  transporter = nodemailer.createTransport(config);

  // Verify connection
  if (process.env.NODE_ENV === 'production') {
    transporter.verify((err, success) => {
      if (err) {
        logger.error('[EmailProvider:SMTP] Verification failed', err);
      } else {
        logger.info('[EmailProvider:SMTP] SMTP server connection verified');
      }
    });
  }

  return transporter;
}

/**
 * Send email via SMTP
 */
async function send({ to, from, fromName, subject, html, text }) {
  const transport = getTransporter();

  try {
    const result = await transport.sendMail({
      from: `${fromName} <${from}>`,
      to,
      subject,
      html,
      text,
      replyTo: from,
    });

    logger.debug('[EmailProvider:SMTP] Email sent successfully', {
      to,
      subject,
      messageId: result.messageId,
    });

    return {
      messageId: result.messageId,
      status: 'sent',
      provider: 'smtp',
    };
  } catch (error) {
    logger.error('[EmailProvider:SMTP] Failed to send email', {
      to,
      subject,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { send };
