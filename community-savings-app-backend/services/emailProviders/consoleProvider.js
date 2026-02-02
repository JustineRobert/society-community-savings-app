// services/emailProviders/consoleProvider.js
// ============================================================================
// Console Email Provider
// Used for development/testing. Logs emails to console instead of sending.
// ============================================================================

const logger = require('../../utils/logger');

/**
 * Send email via console logging
 */
async function send({ to, from, fromName, subject, html, text }) {
  logger.info('[EmailProvider:Console] Email logged to console', {
    to,
    from: `${fromName} <${from}>`,
    subject,
    hasHtml: !!html,
    hasText: !!text,
  });

  // In development, you might want to see the full content
  if (process.env.NODE_ENV === 'development') {
    console.log('\n--- EMAIL START ---');
    console.log(`To: ${to}`);
    console.log(`From: ${fromName} <${from}>`);
    console.log(`Subject: ${subject}\n`);
    console.log('TEXT VERSION:');
    console.log(text);
    console.log('\n--- EMAIL END ---\n');
  }

  return {
    messageId: `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'sent',
    provider: 'console',
  };
}

module.exports = { send };
