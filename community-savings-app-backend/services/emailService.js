// ============================================================================
// File: backend/services/emailService.js
// Description: Enterprise Email Service
// Production Grade Version
// ============================================================================

"use strict";

const crypto = require("crypto");
const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

// ============================================================================
// Constants
// ============================================================================

const EMAIL_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  BOUNCED: "BOUNCED"
};

const EMAIL_PROVIDERS = {
  SMTP: "SMTP",
  SENDGRID: "SENDGRID",
  AWS_SES: "AWS_SES",
  MOCK: "MOCK"
};

const EMAIL_PRIORITY = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
};

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_PROVIDER =
  process.env.EMAIL_PROVIDER ||
  EMAIL_PROVIDERS.SMTP;

const DEFAULT_FROM_EMAIL =
  process.env.EMAIL_FROM ||
  "noreply@communitysavings.com";

const DEFAULT_FROM_NAME =
  process.env.EMAIL_FROM_NAME ||
  "Community Savings";

const EMAIL_TIMEOUT =
  Number(process.env.EMAIL_TIMEOUT_MS || 30000);

// ============================================================================
// Errors
// ============================================================================

class EmailServiceError extends Error {
  constructor(
    message,
    code,
    status = 500,
    metadata = {}
  ) {
    super(message);

    this.name = "EmailServiceError";
    this.code = code;
    this.status = status;
    this.metadata = metadata;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function generateEmailId() {
  return `email_${crypto.randomUUID()}`;
}

function validateEmail(email) {
  const regex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return regex.test(String(email));
}

function normalizeRecipients(to) {
  if (!Array.isArray(to)) {
    return [to];
  }

  return to.filter(Boolean);
}

function validatePayload({
  to,
  subject
}) {
  const recipients =
    normalizeRecipients(to);

  if (!recipients.length) {
    throw new EmailServiceError(
      "Recipient email required",
      "EMAIL_REQUIRED",
      400
    );
  }

  recipients.forEach((email) => {
    if (!validateEmail(email)) {
      throw new EmailServiceError(
        `Invalid email address: ${email}`,
        "INVALID_EMAIL",
        400
      );
    }
  });

  if (!subject) {
    throw new EmailServiceError(
      "Email subject required",
      "SUBJECT_REQUIRED",
      400
    );
  }
}

// ============================================================================
// SMTP Transport
// ============================================================================

let smtpTransport = null;

function getSMTPTransport() {
  if (smtpTransport) {
    return smtpTransport;
  }

  smtpTransport =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST,
      port:
        Number(
          process.env.SMTP_PORT || 587
        ),
      secure:
        process.env.SMTP_SECURE ===
        "true",

      auth:
        process.env.SMTP_USER
          ? {
              user:
                process.env.SMTP_USER,
              pass:
                process.env.SMTP_PASSWORD
            }
          : undefined,

      connectionTimeout:
        EMAIL_TIMEOUT,

      greetingTimeout:
        EMAIL_TIMEOUT,

      socketTimeout:
        EMAIL_TIMEOUT
    });

  return smtpTransport;
}

// ============================================================================
// SMTP Sender
// ============================================================================

async function sendViaSMTP(
  payload
) {
  const transport =
    getSMTPTransport();

  return transport.sendMail(
    payload
  );
}

// ============================================================================
// Mock Sender
// ============================================================================

async function sendViaMock(
  payload
) {
  logger.info(
    "[EMAIL MOCK]",
    {
      to: payload.to,
      subject:
        payload.subject
    }
  );

  return {
    accepted:
      normalizeRecipients(
        payload.to
      ),
    provider: "MOCK"
  };
}

// ============================================================================
// Provider Router
// ============================================================================

async function routeEmail(
  provider,
  payload
) {
  switch (provider) {
    case EMAIL_PROVIDERS.SMTP:
      return sendViaSMTP(
        payload
      );

    case EMAIL_PROVIDERS.MOCK:
    default:
      return sendViaMock(
        payload
      );
  }
}

// ============================================================================
// Core Email Sender
// ============================================================================

async function send({
  to,
  cc = [],
  bcc = [],
  subject,
  text,
  html,

  attachments = [],

  provider =
    DEFAULT_PROVIDER,

  priority =
    EMAIL_PRIORITY.NORMAL,

  tenantId = null,

  metadata = {}
}) {
  validatePayload({
    to,
    subject
  });

  const emailId =
    generateEmailId();

  try {
    const payload = {
      from: {
        name:
          DEFAULT_FROM_NAME,
        address:
          DEFAULT_FROM_EMAIL
      },

      to,
      cc,
      bcc,

      subject,
      text,
      html,

      attachments,

      priority:
        priority.toLowerCase()
    };

    const response =
      await routeEmail(
        provider,
        payload
      );

    logger.info(
      "Email sent successfully",
      {
        emailId,
        tenantId,
        provider,
        subject
      }
    );

    return {
      success: true,

      emailId,

      provider,

      status:
        EMAIL_STATUS.SENT,

      subject,

      recipients:
        normalizeRecipients(
          to
        ),

      providerResponse:
        response,

      metadata
    };
  } catch (error) {
    logger.error(
      "Email send failed",
      {
        emailId,
        provider,
        subject,
        error:
          error.message
      }
    );

    throw new EmailServiceError(
      error.message,
      "EMAIL_SEND_FAILED",
      500
    );
  }
}

// ============================================================================
// Bulk Email
// ============================================================================

async function sendBulk({
  recipients,
  subject,
  html,
  text
}) {
  const results =
    await Promise.allSettled(
      recipients.map((email) =>
        send({
          to: email,
          subject,
          html,
          text
        })
      )
    );

  return results;
}

// ============================================================================
// OTP Email
// ============================================================================

async function sendOTP({
  email,
  otp,
  tenantName =
    "Community Savings"
}) {
  return send({
    to: email,

    subject:
      "Verification Code",

    html: `
      <h3>${tenantName}</h3>
      <p>Your verification code is:</p>
      <h2>${otp}</h2>
      <p>Do not share this code.</p>
    `,

    text:
      `Your verification code is ${otp}`
  });
}

// ============================================================================
// Transaction Alert
// ============================================================================

async function sendTransactionAlert({
  email,
  amount,
  transactionType,
  reference
}) {
  return send({
    to: email,

    subject:
      `${transactionType} Notification`,

    html: `
      <h3>${transactionType}</h3>
      <p>Amount: UGX ${amount}</p>
      <p>Reference: ${reference}</p>
    `,

    text:
      `${transactionType}: UGX ${amount}. Ref: ${reference}`
  });
}

// ============================================================================
// Loan Notification
// ============================================================================

async function sendLoanApproval({
  email,
  amount,
  loanId
}) {
  return send({
    to: email,

    subject:
      "Loan Approved",

    html: `
      <h2>Loan Approved</h2>
      <p>Your loan application has been approved.</p>
      <p>Amount: UGX ${amount}</p>
      <p>Loan ID: ${loanId}</p>
    `
  });
}

// ============================================================================
// Templates
// ============================================================================

const templates = {
  welcome(data) {
    return {
      subject:
        "Welcome",

      html: `
        <h2>Welcome ${data.name}</h2>
        <p>Thank you for joining us.</p>
      `
    };
  },

  repaymentReceived(data) {
    return {
      subject:
        "Repayment Received",

      html: `
        <h3>Repayment Received</h3>
        <p>Amount: UGX ${data.amount}</p>
      `
    };
  },

  savingsDeposit(data) {
    return {
      subject:
        "Deposit Successful",

      html: `
        <h3>Deposit Successful</h3>
        <p>Amount: UGX ${data.amount}</p>
      `
    };
  },

  billingInvoice(data) {
    return {
      subject:
        "Invoice Generated",

      html: `
        <h3>Invoice</h3>
        <p>Invoice #: ${data.invoiceNumber}</p>
        <p>Amount: UGX ${data.amount}</p>
      `
    };
  }
};

// ============================================================================
// Email Verification
// ============================================================================

async function verifyTransport() {
  try {
    if (
      DEFAULT_PROVIDER !==
      EMAIL_PROVIDERS.SMTP
    ) {
      return true;
    }

    const transport =
      getSMTPTransport();

    await transport.verify();

    return true;
  } catch (error) {
    logger.error(
      "SMTP verification failed",
      {
        error:
          error.message
      }
    );

    return false;
  }
}

// ============================================================================
// Health Check
// ============================================================================

async function healthCheck() {
  const verified =
    await verifyTransport();

  return {
    service:
      "email-service",

    provider:
      DEFAULT_PROVIDER,

    status:
      verified
        ? "UP"
        : "DEGRADED",

    timestamp:
      new Date().toISOString()
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  EMAIL_STATUS,
  EMAIL_PRIORITY,
  EMAIL_PROVIDERS,

  EmailServiceError,

  send,
  sendBulk,

  sendOTP,
  sendTransactionAlert,
  sendLoanApproval,

  verifyTransport,

  templates,

  healthCheck
};