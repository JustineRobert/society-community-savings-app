/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Constants
 * ============================================================
 */

/**
 * ============================================================
 * ONBOARDING STATUS
 * ============================================================
 */
const STATUS = Object.freeze({
  DRAFT: "DRAFT",

  VERIFICATION: "VERIFICATION",

  KYC_PENDING: "KYC_PENDING",

  KYC_APPROVED: "KYC_APPROVED",

  SUBSCRIPTION: "SUBSCRIPTION",

  GO_LIVE_REVIEW: "GO_LIVE_REVIEW",

  LIVE: "LIVE",

  SUSPENDED: "SUSPENDED",

  REJECTED: "REJECTED"
});

/**
 * ============================================================
 * SUBSCRIPTION PLANS
 * ============================================================
 */
const SUBSCRIPTION_PLANS = Object.freeze({
  STARTER: "STARTER",

  GROWTH: "GROWTH",

  ENTERPRISE: "ENTERPRISE",

  CUSTOM: "CUSTOM"
});

/**
 * ============================================================
 * BILLING CYCLES
 * ============================================================
 */
const BILLING_CYCLES = Object.freeze({
  MONTHLY: "MONTHLY",

  QUARTERLY: "QUARTERLY",

  ANNUAL: "ANNUAL"
});

/**
 * ============================================================
 * SUPPORTED CURRENCIES
 * ============================================================
 */
const CURRENCIES = Object.freeze({
  UGX: "UGX",

  USD: "USD",

  KES: "KES",

  TZS: "TZS",

  RWF: "RWF"
});

/**
 * ============================================================
 * COMPLIANCE STATUS
 * ============================================================
 */
const COMPLIANCE_STATUS = Object.freeze({
  PENDING: "PENDING",

  UNDER_REVIEW: "UNDER_REVIEW",

  COMPLIANT: "COMPLIANT",

  NON_COMPLIANT: "NON_COMPLIANT"
});

/**
 * ============================================================
 * MOBILE MONEY PROVIDERS
 * ============================================================
 */
const MOBILE_MONEY_PROVIDERS =
  Object.freeze({
    MTN: "MTN",

    AIRTEL: "AIRTEL"
  });

/**
 * ============================================================
 * DOCUMENT TYPES
 * ============================================================
 */
const DOCUMENT_TYPES =
  Object.freeze({
    REGISTRATION_CERTIFICATE:
      "REGISTRATION_CERTIFICATE",

    TIN_CERTIFICATE:
      "TIN_CERTIFICATE",

    BOARD_RESOLUTION:
      "BOARD_RESOLUTION",

    MEMORANDUM:
      "MEMORANDUM",

    PROOF_OF_ADDRESS:
      "PROOF_OF_ADDRESS",

    KYC_DOCUMENT:
      "KYC_DOCUMENT",

    AML_DOCUMENT:
      "AML_DOCUMENT",

    OTHER:
      "OTHER"
  });

/**
 * ============================================================
 * AUDIT EVENTS
 * ============================================================
 */
const AUDIT_EVENTS = Object.freeze({
  SACCO_REGISTERED:
    "SACCO_REGISTERED",

  SACCO_UPDATED:
    "SACCO_UPDATED",

  KYC_SUBMITTED:
    "KYC_SUBMITTED",

  KYC_APPROVED:
    "KYC_APPROVED",

  SUBSCRIPTION_CREATED:
    "SUBSCRIPTION_CREATED",

  SUBSCRIPTION_UPDATED:
    "SUBSCRIPTION_UPDATED",

  GO_LIVE_REVIEW_STARTED:
    "GO_LIVE_REVIEW_STARTED",

  GO_LIVE_APPROVED:
    "GO_LIVE_APPROVED",

  SACCO_LIVE:
    "SACCO_LIVE",

  SACCO_SUSPENDED:
    "SACCO_SUSPENDED",

  SACCO_REJECTED:
    "SACCO_REJECTED",

  DOCUMENT_UPLOADED:
    "DOCUMENT_UPLOADED"
});

/**
 * ============================================================
 * RBAC PERMISSIONS
 * ============================================================
 */
const PERMISSIONS = Object.freeze({
  SACCO_CREATE:
    "SACCO_CREATE",

  SACCO_VIEW:
    "SACCO_VIEW",

  SACCO_UPDATE:
    "SACCO_UPDATE",

  SACCO_DELETE:
    "SACCO_DELETE",

  SACCO_KYC_APPROVE:
    "SACCO_KYC_APPROVE",

  SACCO_SUBSCRIPTION:
    "SACCO_SUBSCRIPTION",

  SACCO_GO_LIVE:
    "SACCO_GO_LIVE",

  SACCO_GO_LIVE_REVIEW:
    "SACCO_GO_LIVE_REVIEW",

  SACCO_REJECT:
    "SACCO_REJECT",

  SACCO_ANALYTICS:
    "SACCO_ANALYTICS"
});

/**
 * ============================================================
 * ONBOARDING CHECKLIST
 * ============================================================
 */
const CHECKLIST_ITEMS = Object.freeze({
  REGISTRATION_COMPLETED:
    "registrationCompleted",

  KYC_COMPLETED:
    "kycCompleted",

  SUBSCRIPTION_COMPLETED:
    "subscriptionCompleted",

  TENANT_CREATED:
    "tenantSetupCompleted",

  ADMIN_CREATED:
    "adminCreated",

  MOBILE_MONEY_CONFIGURED:
    "mobileMoneyConfigured",

  TRAINING_COMPLETED:
    "trainingCompleted",

  GO_LIVE_APPROVED:
    "goLiveApproved"
});

/**
 * ============================================================
 * DASHBOARD COLORS
 * ============================================================
 */
const STATUS_COLORS =
  Object.freeze({
    DRAFT: "#6B7280",

    VERIFICATION: "#2563EB",

    KYC_PENDING: "#F59E0B",

    KYC_APPROVED: "#10B981",

    SUBSCRIPTION: "#8B5CF6",

    GO_LIVE_REVIEW: "#06B6D4",

    LIVE: "#22C55E",

    SUSPENDED: "#EF4444",

    REJECTED: "#7F1D1D"
  });

/**
 * ============================================================
 * TENANT DEFAULTS
 * ============================================================
 */
const TENANT_DEFAULTS =
  Object.freeze({
    COUNTRY: "Uganda",

    TIMEZONE:
      "Africa/Kampala",

    DEFAULT_CURRENCY:
      "UGX"
  });

/**
 * ============================================================
 * API LIMITS
 * ============================================================
 */
const LIMITS = Object.freeze({
  MAX_DOCUMENTS: 20,

  MAX_FILE_SIZE_MB: 25,

  DEFAULT_PAGE_SIZE: 20,

  MAX_PAGE_SIZE: 100
});

/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */
module.exports = {
  STATUS,

  SUBSCRIPTION_PLANS,

  BILLING_CYCLES,

  CURRENCIES,

  COMPLIANCE_STATUS,

  MOBILE_MONEY_PROVIDERS,

  DOCUMENT_TYPES,

  AUDIT_EVENTS,

  PERMISSIONS,

  CHECKLIST_ITEMS,

  STATUS_COLORS,

  TENANT_DEFAULTS,

  LIMITS
};