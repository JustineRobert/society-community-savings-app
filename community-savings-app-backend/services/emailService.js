// community-savings-app-backend/services/emailService.js

/**
 * Email Service
 *
 * Handles email sending for:
 * - Email verification
 * - Password reset
 * - Notifications
 * - Marketing emails
 *
 * Supports multiple email providers and templates.
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');

// Email templates
const EMAIL_TEMPLATES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  WELCOME: 'welcome',
  GROUP_INVITATION: 'group_invitation',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  LOAN_APPROVED: 'loan_approved',
  LOAN_REJECTED: 'loan_rejected',
  CONTRIBUTION_REMINDER: 'contribution_reminder'
};

// Email configuration
const EMAIL_CONFIG = {
  provider: process.env.EMAIL_PROVIDER || 'gmail',
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  from: process.env.EMAIL_FROM || 'noreply@communitysavings.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Community Savings'
};

// Create email transporter
let transporter;
try {
  if (EMAIL_CONFIG.provider === 'gmail') {
    transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: EMAIL_CONFIG.auth
    });
  } else {
    transporter = nodemailer.createTransporter({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      auth: EMAIL_CONFIG.auth
    });
  }
  logger.info('Email service initialized successfully');
} catch (error) {
  logger.error('Failed to initialize email service:', error);
  transporter = null;
}

/**
 * Send email verification
 */
async function sendEmailVerification(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('Email already verified');
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to user
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const emailData = {
      to: user.email,
      subject: 'Verify Your Email - Community Savings',
      template: EMAIL_TEMPLATES.EMAIL_VERIFICATION,
      data: {
        userName: user.name,
        verificationUrl,
        expiresIn: '24 hours'
      }
    };

    await sendEmail(emailData);

    logger.info(`Email verification sent to ${user.email}`);
    return { success: true, message: 'Verification email sent' };

  } catch (error) {
    logger.error('Email verification sending failed:', error);
    throw error;
  }
}

/**
 * Verify email with token
 */
async function verifyEmail(token) {
  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerifiedAt = new Date();
    await user.save();

    // Send welcome email
    await sendWelcomeEmail(user._id);

    logger.info(`Email verified for user ${user.email}`);
    return { success: true, user: { id: user._id, email: user.email, name: user.name } };

  } catch (error) {
    logger.error('Email verification failed:', error);
    throw error;
  }
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email) {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists for security
      return { success: true, message: 'If an account with that email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Hash token before saving
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token to user
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const emailData = {
      to: user.email,
      subject: 'Password Reset - Community Savings',
      template: EMAIL_TEMPLATES.PASSWORD_RESET,
      data: {
        userName: user.name,
        resetUrl,
        expiresIn: '1 hour'
      }
    };

    await sendEmail(emailData);

    logger.info(`Password reset email sent to ${user.email}`);
    return { success: true, message: 'Password reset email sent' };

  } catch (error) {
    logger.error('Password reset email sending failed:', error);
    throw error;
  }
}

/**
 * Reset password with token
 */
async function resetPassword(token, newPassword) {
  try {
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save middleware
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    // Send confirmation email
    await sendPasswordResetConfirmation(user._id);

    logger.info(`Password reset successful for user ${user.email}`);
    return { success: true, message: 'Password reset successful' };

  } catch (error) {
    logger.error('Password reset failed:', error);
    throw error;
  }
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const emailData = {
      to: user.email,
      subject: 'Welcome to Community Savings!',
      template: EMAIL_TEMPLATES.WELCOME,
      data: {
        userName: user.name,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
        supportEmail: 'support@communitysavings.com'
      }
    };

    await sendEmail(emailData);
    logger.info(`Welcome email sent to ${user.email}`);

  } catch (error) {
    logger.error('Welcome email sending failed:', error);
  }
}

/**
 * Send password reset confirmation
 */
async function sendPasswordResetConfirmation(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const emailData = {
      to: user.email,
      subject: 'Password Changed - Community Savings',
      template: 'password_changed',
      data: {
        userName: user.name,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
        supportEmail: 'support@communitysavings.com'
      }
    };

    await sendEmail(emailData);
    logger.info(`Password change confirmation sent to ${user.email}`);

  } catch (error) {
    logger.error('Password change confirmation failed:', error);
  }
}

/**
 * Send group invitation email
 */
async function sendGroupInvitation(email, inviterName, groupName, inviteToken) {
  try {
    const inviteUrl = `${process.env.FRONTEND_URL}/join-group?token=${inviteToken}`;

    const emailData = {
      to: email,
      subject: `You're invited to join ${groupName}`,
      template: EMAIL_TEMPLATES.GROUP_INVITATION,
      data: {
        inviterName,
        groupName,
        inviteUrl,
        expiresIn: '7 days'
      }
    };

    await sendEmail(emailData);
    logger.info(`Group invitation sent to ${email} for ${groupName}`);

  } catch (error) {
    logger.error('Group invitation email failed:', error);
  }
}

/**
 * Send payment confirmation
 */
async function sendPaymentConfirmation(userId, paymentDetails) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const emailData = {
      to: user.email,
      subject: 'Payment Confirmation - Community Savings',
      template: EMAIL_TEMPLATES.PAYMENT_CONFIRMATION,
      data: {
        userName: user.name,
        ...paymentDetails,
        supportEmail: 'support@communitysavings.com'
      }
    };

    await sendEmail(emailData);
    logger.info(`Payment confirmation sent to ${user.email}`);

  } catch (error) {
    logger.error('Payment confirmation email failed:', error);
  }
}

/**
 * Send loan status notification
 */
async function sendLoanNotification(userId, loanDetails, type = 'approved') {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const templates = {
      approved: EMAIL_TEMPLATES.LOAN_APPROVED,
      rejected: EMAIL_TEMPLATES.LOAN_REJECTED
    };

    const subjects = {
      approved: 'Loan Approved - Community Savings',
      rejected: 'Loan Application Update - Community Savings'
    };

    const emailData = {
      to: user.email,
      subject: subjects[type],
      template: templates[type],
      data: {
        userName: user.name,
        ...loanDetails,
        supportEmail: 'support@communitysavings.com'
      }
    };

    await sendEmail(emailData);
    logger.info(`Loan ${type} notification sent to ${user.email}`);

  } catch (error) {
    logger.error(`Loan ${type} notification failed:`, error);
  }
}

/**
 * Send contribution reminder
 */
async function sendContributionReminder(userId, groupName, amount, dueDate) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const emailData = {
      to: user.email,
      subject: `Contribution Reminder - ${groupName}`,
      template: EMAIL_TEMPLATES.CONTRIBUTION_REMINDER,
      data: {
        userName: user.name,
        groupName,
        amount,
        dueDate: dueDate.toDateString(),
        paymentUrl: `${process.env.FRONTEND_URL}/contribute`
      }
    };

    await sendEmail(emailData);
    logger.info(`Contribution reminder sent to ${user.email}`);

  } catch (error) {
    logger.error('Contribution reminder failed:', error);
  }
}

/**
 * Core email sending function
 */
async function sendEmail({ to, subject, template, data, attachments = [] }) {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  try {
    // Get email template content
    const { html, text } = getEmailTemplate(template, data);

    const mailOptions = {
      from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.from}>`,
      to,
      subject,
      html,
      text,
      attachments
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to}: ${result.messageId}`);

    return result;

  } catch (error) {
    logger.error(`Email sending failed to ${to}:`, error);
    throw error;
  }
}

/**
 * Get email template content
 */
function getEmailTemplate(template, data) {
  const templates = {
    [EMAIL_TEMPLATES.EMAIL_VERIFICATION]: {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Community Savings!</h2>
          <p>Hi ${data.userName},</p>
          <p>Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Verify Email</a>
          </div>
          <p>This link will expire in ${data.expiresIn}.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
      `,
      text: `Hi ${data.userName},\n\nPlease verify your email: ${data.verificationUrl}\n\nThis link expires in ${data.expiresIn}.`
    },

    [EMAIL_TEMPLATES.PASSWORD_RESET]: {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Hi ${data.userName},</p>
          <p>You requested a password reset for your Community Savings account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a>
          </div>
          <p>This link will expire in ${data.expiresIn}.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
      text: `Hi ${data.userName},\n\nReset your password: ${data.resetUrl}\n\nThis link expires in ${data.expiresIn}.`
    },

    [EMAIL_TEMPLATES.WELCOME]: {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Community Savings! 🎉</h2>
          <p>Hi ${data.userName},</p>
          <p>Thank you for joining Community Savings! Your account is now active.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Get Started</a>
          </div>
          <p>Need help? Contact us at ${data.supportEmail}</p>
        </div>
      `,
      text: `Welcome ${data.userName}! Your account is active. Login: ${data.loginUrl}`
    }
  };

  const templateContent = templates[template];
  if (!templateContent) {
    throw new Error(`Email template '${template}' not found`);
  }

  return templateContent;
}

/**
 * Test email configuration
 */
async function testEmailConfiguration() {
  try {
    if (!transporter) {
      throw new Error('Email transporter not initialized');
    }

    await transporter.verify();
    return { success: true, message: 'Email configuration is working' };

  } catch (error) {
    logger.error('Email configuration test failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmailVerification,
  verifyEmail,
  sendPasswordReset,
  resetPassword,
  sendWelcomeEmail,
  sendGroupInvitation,
  sendPaymentConfirmation,
  sendLoanNotification,
  sendContributionReminder,
  testEmailConfiguration,
  EMAIL_TEMPLATES
};
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
