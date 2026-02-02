// services/emailService.js
// ============================================================================
// Email Service
// Abstraction layer for sending emails via multiple providers
// Supports: SendGrid, AWS SES, Mailgun, SMTP
// Production-ready with retry logic, templates, and error handling
// ============================================================================

const logger = require('../utils/logger');

// Detect which email provider to use
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console'; // 'sendgrid', 'ses', 'mailgun', 'smtp', 'console'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@community-savings.app';
const FROM_NAME = process.env.FROM_NAME || 'Community Savings';

// Import provider implementations based on environment
let emailProvider;

switch (EMAIL_PROVIDER) {
  case 'sendgrid':
    emailProvider = require('./emailProviders/sendgridProvider');
    break;
  case 'ses':
    emailProvider = require('./emailProviders/sesProvider');
    break;
  case 'mailgun':
    emailProvider = require('./emailProviders/mailgunProvider');
    break;
  case 'smtp':
    emailProvider = require('./emailProviders/smtpProvider');
    break;
  case 'console':
  default:
    emailProvider = require('./emailProviders/consoleProvider');
    break;
}

// ============================================================================
// Email Templates
// ============================================================================

function getVerificationEmailTemplate(name, verificationUrl) {
  return {
    subject: 'Verify Your Email - Community Savings App',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
            .content { background: #f5f5f5; padding: 20px; }
            .button { display: inline-block; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { font-size: 12px; color: #666; text-align: center; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(name)},</p>
              <p>Thank you for registering with Community Savings App. To complete your registration and start saving with your community, please verify your email address.</p>
              <p>
                <a href="${escapeHtml(verificationUrl)}" class="button">Verify Email</a>
              </p>
              <p>Or copy and paste this link in your browser:</p>
              <p><code>${escapeHtml(verificationUrl)}</code></p>
              <p style="font-size: 12px; color: #666;">This link will expire in 24 hours.</p>
              <p>If you didn't create this account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Community Savings App. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hello ${name},
      
      Thank you for registering with Community Savings App. To complete your registration, please verify your email by visiting this link:
      
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create this account, you can safely ignore this email.
      
      Best regards,
      Community Savings Team
    `,
  };
}

function getPasswordResetEmailTemplate(name, resetUrl) {
  return {
    subject: 'Reset Your Password - Community Savings App',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
            .content { background: #f5f5f5; padding: 20px; }
            .button { display: inline-block; padding: 10px 20px; background: #d32f2f; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { font-size: 12px; color: #666; text-align: center; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(name)},</p>
              <p>We received a request to reset the password for your Community Savings App account. Click the button below to set a new password:</p>
              <p>
                <a href="${escapeHtml(resetUrl)}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link in your browser:</p>
              <p><code>${escapeHtml(resetUrl)}</code></p>
              <p style="font-size: 12px; color: #666;">This link will expire in 15 minutes for security reasons.</p>
              <p><strong>Important:</strong> If you didn't request a password reset, please ignore this email or contact us immediately if you believe your account is at risk.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Community Savings App. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hello ${name},
      
      We received a request to reset the password for your account. To set a new password, visit this link:
      
      ${resetUrl}
      
      This link will expire in 15 minutes.
      
      If you didn't request this, please ignore this email or contact us immediately.
      
      Best regards,
      Community Savings Team
    `,
  };
}

function getPasswordChangedEmailTemplate(name) {
  return {
    subject: 'Password Changed - Community Savings App',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #388e3c; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
            .content { background: #f5f5f5; padding: 20px; }
            .footer { font-size: 12px; color: #666; text-align: center; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Updated</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(name)},</p>
              <p>Your password has been successfully changed. If you did not make this change, please contact us immediately.</p>
              <p>For security reasons, all active sessions have been logged out. You will need to log in again with your new password.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Community Savings App. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hello ${name},
      
      Your password has been successfully changed. If you did not make this change, please contact us immediately.
      
      For security, all active sessions have been logged out. Log in again with your new password.
      
      Best regards,
      Community Savings Team
    `,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Retry logic for email sending
 */
async function sendWithRetry(sendFn, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendFn();
    } catch (error) {
      lastError = error;
      logger.warn(`[EmailService] Send attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ============================================================================
// Public Email Functions
// ============================================================================

/**
 * Send verification email
 */
async function sendVerificationEmail(email, name, verificationUrl) {
  const template = getVerificationEmailTemplate(name, verificationUrl);

  return sendWithRetry(async () => {
    return emailProvider.send({
      to: email,
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, name, resetUrl) {
  const template = getPasswordResetEmailTemplate(name, resetUrl);

  return sendWithRetry(async () => {
    return emailProvider.send({
      to: email,
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  });
}

/**
 * Send password changed notification
 */
async function sendPasswordChangedEmail(email, name) {
  const template = getPasswordChangedEmailTemplate(name);

  return sendWithRetry(async () => {
    return emailProvider.send({
      to: email,
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  });
}

/**
 * Send transactional email (generic)
 */
async function sendTransactionalEmail(to, subject, html, text) {
  return sendWithRetry(async () => {
    return emailProvider.send({
      to,
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      subject,
      html,
      text,
    });
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendTransactionalEmail,
};
