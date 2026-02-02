// services/emailProviders/sesProvider.js
// ============================================================================
// AWS SES (Simple Email Service) Provider
// Production-grade email delivery via AWS SES
// ============================================================================

const logger = require('../../utils/logger');

// Lazy-load AWS SDK
let SESClient, SendEmailCommand;
try {
  const { SESClient: SES, SendEmailCommand: SEC } = require('@aws-sdk/client-ses');
  SESClient = SES;
  SendEmailCommand = SEC;
} catch (err) {
  logger.warn('[EmailProvider:SES] AWS SDK not installed. Install with: npm install @aws-sdk/client-ses');
}

let sesClient;

function getSESClient() {
  if (!sesClient && SESClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return sesClient;
}

/**
 * Send email via AWS SES
 */
async function send({ to, from, fromName, subject, html, text }) {
  const client = getSESClient();

  if (!client) {
    throw new Error('AWS SES not configured. Install @aws-sdk/client-ses and set AWS_REGION');
  }

  try {
    const command = new SendEmailCommand({
      Source: `${fromName} <${from}>`,
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: text,
            Charset: 'UTF-8',
          },
        },
      },
      Tags: [
        {
          Name: 'Service',
          Value: 'CommunitySavingsApp',
        },
      ],
    });

    const result = await client.send(command);

    logger.debug('[EmailProvider:SES] Email sent successfully', {
      to,
      subject,
      messageId: result.MessageId,
    });

    return {
      messageId: result.MessageId,
      status: 'sent',
      provider: 'ses',
    };
  } catch (error) {
    logger.error('[EmailProvider:SES] Failed to send email', {
      to,
      subject,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { send };
