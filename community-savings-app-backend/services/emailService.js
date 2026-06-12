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
  CONTRIBUTION_REMINDER: 'contribution_reminder',
};

// Email configuration
const EMAIL_CONFIG = {
  provider: process.env.EMAIL_PROVIDER || 'gmail',
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  from: process.env.EMAIL_FROM || 'noreply@communitysavings.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Community Savings',
};

// ✅ EMAIL UTILITIES FIXES

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')      // ✅ FIRST
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const FROM_EMAIL = EMAIL_CONFIG.from;
const FROM_NAME = EMAIL_CONFIG.fromName;

// ✅ SIMPLE PROVIDER WRAPPER (uses nodemailer)
const emailProvider = {
  send: async ({ to, subject, html, text }) => {
    return transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
  },
};

// ✅ RETRY WRAPPER
async function sendWithRetry(fn, retries = 3) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      logger.warn(`Email retry ${i + 1} failed`);
    }
  }

  throw lastError;
}

// Create email transporter
let transporter;
try {
  if (EMAIL_CONFIG.provider === 'gmail') {
    transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: EMAIL_CONFIG.auth,
    });
  } else {
    transporter = nodemailer.createTransporter({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      auth: EMAIL_CONFIG.auth,
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
        expiresIn: '24 hours',
      },
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
      emailVerificationExpires: { $gt: new Date() },
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
      return {
        success: true,
        message: 'If an account with that email exists, a reset link has been sent',
      };
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
        expiresIn: '1 hour',
      },
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
      passwordResetExpires: { $gt: new Date() },
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
        supportEmail: 'support@communitysavings.com',
      },
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
        supportEmail: 'support@communitysavings.com',
      },
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
        expiresIn: '7 days',
      },
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
        supportEmail: 'support@communitysavings.com',
      },
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
      rejected: EMAIL_TEMPLATES.LOAN_REJECTED,
    };

    const subjects = {
      approved: 'Loan Approved - Community Savings',
      rejected: 'Loan Application Update - Community Savings',
    };

    const emailData = {
      to: user.email,
      subject: subjects[type],
      template: templates[type],
      data: {
        userName: user.name,
        ...loanDetails,
        supportEmail: 'support@communitysavings.com',
      },
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
        paymentUrl: `${process.env.FRONTEND_URL}/contribute`,
      },
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
      attachments,
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
      text: `Hi ${data.userName},\n\nPlease verify your email: ${data.verificationUrl}\n\nThis link expires in ${data.expiresIn}.`,
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
      text: `Hi ${data.userName},\n\nReset your password: ${data.resetUrl}\n\nThis link expires in ${data.expiresIn}.`,
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
      text: `Welcome ${data.userName}! Your account is active. Login: ${data.loginUrl}`,
    },
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

// ✅ MAIN TEMPLATE FUNCTION (FIXED HTML)
function getEmailVerificationTemplate(name, verificationUrl) {
  return {
    subject: 'Email Verification - Community Savings App',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
            .content { background: #f5f5f5; padding: 20px; }
            .button {
              display: inline-block;
              padding: 10px 20px;
              background: #1976d2;
              color: white;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(name)},</p>
              <p>Please verify your email:</p>
              <a href="${escapeHtml(verificationUrl)}">Verify Email</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hello ${name},

Verify your email:
${verificationUrl}
    `,
  };
}

// ✅ ALIAS FUNCTION (FIXES UNDEFINED ERROR)
function getVerificationEmailTemplate(name, verificationUrl) {
  return getEmailVerificationTemplate(name, verificationUrl);
}

// ============================================================================
// Public Email Functions
// ============================================================================
// ✅ Password Reset Template
function getPasswordResetEmailTemplate(name, resetUrl) {
  return {
    subject: 'Password Reset - Community Savings',
    html: `
      <p>Hello ${escapeHtml(name)}</p>
      <p>Reset your password:</p>
      <a href="${escapeHtml(resetUrl)}">Reset Password</a>
    `,
    text: `Reset your password: ${resetUrl}`,
  };
}

// ✅ Password Changed Template
function getPasswordChangedEmailTemplate(name) {
  return {
    subject: 'Password Changed',
    html: `<p>Hello ${escapeHtml(name)}, your password has been updated.</p>`,
    text: `Your password was successfully changed.`,
  };
}

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
