// services/emailProviders/mailgunProvider.js
// ============================================================================
// Mailgun Email Provider
// Production-grade email delivery via Mailgun API
// ============================================================================

const logger = require('../../utils/logger');

// Lazy-load Mailgun
let FormData, mailgunClient;
try {
  FormData = require('form-data');
  mailgunClient = require('mailgun.js');
} catch (err) {
  logger.warn('[EmailProvider:Mailgun] Mailgun SDK not installed. Install with: npm install mailgun.js form-data');
}

let mailgun;

function getMailgunClient() {
  if (!mailgun && mailgunClient && FormData) {
    const mg = new mailgunClient(FormData);
    mailgun = mg.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY,
    });
  }
  return mailgun;
}

/**
 * Send email via Mailgun
 */
async function send({ to, from, fromName, subject, html, text }) {
  const mg = getMailgunClient();

  if (!mg) {
    throw new Error('Mailgun not configured. Install mailgun.js, form-data, and set MAILGUN_API_KEY');
  }

  const domain = process.env.MAILGUN_DOMAIN;
  if (!domain) {
    throw new Error('MAILGUN_DOMAIN environment variable not set');
  }

  try {
    const result = await mg.messages.create(domain, {
      from: `${fromName} <${from}>`,
      to,
      subject,
      html,
      text,
      'h:Reply-To': from,
      'o:tracking': true,
      'o:tracking-clicks': true,
      'o:tracking-opens': true,
    });

    logger.debug('[EmailProvider:Mailgun] Email sent successfully', {
      to,
      subject,
      messageId: result.id,
    });

    return {
      messageId: result.id,
      status: 'sent',
      provider: 'mailgun',
    };
  } catch (error) {
    logger.error('[EmailProvider:Mailgun] Failed to send email', {
      to,
      subject,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { send };
