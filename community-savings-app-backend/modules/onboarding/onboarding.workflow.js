/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Workflow Engine
 * ============================================================
 *
 * Purpose:
 * - Manage SACCO onboarding lifecycle
 * - Validate workflow transitions
 * - Track onboarding progress
 * - Enforce compliance requirements
 * - Support audit logging
 * - Support MTN MoMo & Airtel Money onboarding readiness
 * - Support multi-tenant SACCO operations
 * ============================================================
 */

/**
 * ============================================================
 * WORKFLOW STATES
 * ============================================================
 */
const STATES = Object.freeze({
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
 * WORKFLOW ORDER
 * ============================================================
 */
const WORKFLOW_ORDER = [
  STATES.DRAFT,
  STATES.VERIFICATION,
  STATES.KYC_PENDING,
  STATES.KYC_APPROVED,
  STATES.SUBSCRIPTION,
  STATES.GO_LIVE_REVIEW,
  STATES.LIVE
];

/**
 * ============================================================
 * VALID STATE TRANSITIONS
 * ============================================================
 */
const TRANSITIONS = {
  [STATES.DRAFT]: [
    STATES.VERIFICATION,
    STATES.REJECTED
  ],

  [STATES.VERIFICATION]: [
    STATES.KYC_PENDING,
    STATES.REJECTED
  ],

  [STATES.KYC_PENDING]: [
    STATES.KYC_APPROVED,
    STATES.REJECTED
  ],

  [STATES.KYC_APPROVED]: [
    STATES.SUBSCRIPTION,
    STATES.REJECTED
  ],

  [STATES.SUBSCRIPTION]: [
    STATES.GO_LIVE_REVIEW,
    STATES.REJECTED
  ],

  [STATES.GO_LIVE_REVIEW]: [
    STATES.LIVE,
    STATES.REJECTED
  ],

  [STATES.LIVE]: [
    STATES.SUSPENDED
  ],

  [STATES.SUSPENDED]: [
    STATES.LIVE
  ],

  [STATES.REJECTED]: []
};

/**
 * ============================================================
 * VALIDATE TRANSITION
 * ============================================================
 */
const canTransition = (
  currentStatus,
  targetStatus
) => {
  const allowed =
    TRANSITIONS[currentStatus] || [];

  return allowed.includes(
    targetStatus
  );
};

/**
 * ============================================================
 * NEXT STEP
 * ============================================================
 */
const nextStep = (
  currentStatus
) => {
  const allowed =
    TRANSITIONS[currentStatus];

  if (
    !allowed ||
    allowed.length === 0
  ) {
    return null;
  }

  return allowed[0];
};

/**
 * ============================================================
 * PREVIOUS STEP
 * ============================================================
 */
const previousStep = (
  currentStatus
) => {
  const index =
    WORKFLOW_ORDER.indexOf(
      currentStatus
    );

  if (index <= 0) {
    return null;
  }

  return WORKFLOW_ORDER[
    index - 1
  ];
};

/**
 * ============================================================
 * STAGE NUMBER
 * ============================================================
 */
const getStageNumber = (
  currentStatus
) => {
  const index =
    WORKFLOW_ORDER.indexOf(
      currentStatus
    );

  return index === -1
    ? 0
    : index + 1;
};

/**
 * ============================================================
 * PROGRESS %
 * ============================================================
 */
const calculateProgress = (
  currentStatus
) => {
  const stage =
    getStageNumber(
      currentStatus
    );

  if (stage === 0) {
    return 0;
  }

  return Math.round(
    (stage /
      WORKFLOW_ORDER.length) *
      100
  );
};

/**
 * ============================================================
 * COMPLIANCE CHECK
 * ============================================================
 */
const validateCompliance = (
  sacco
) => {
  const issues = [];

  if (
    !sacco.registrationNumber
  ) {
    issues.push(
      "Registration number missing"
    );
  }

  if (
    !sacco.tinNumber
  ) {
    issues.push(
      "TIN number missing"
    );
  }

  if (
    !sacco.kycCompleted
  ) {
    issues.push(
      "KYC incomplete"
    );
  }

  if (
    !sacco.documents ||
    sacco.documents.length === 0
  ) {
    issues.push(
      "Required documents missing"
    );
  }

  return {
    compliant:
      issues.length === 0,
    issues
  };
};

/**
 * ============================================================
 * MOBILE MONEY READINESS
 * ============================================================
 */
const validateMobileMoneySetup = (
  sacco
) => {
  const issues = [];

  if (
    !sacco.mobileMoneyEnabled
  ) {
    issues.push(
      "Mobile money not enabled"
    );
  }

  if (
    !sacco.mtnMomoEnabled &&
    !sacco.airtelMoneyEnabled
  ) {
    issues.push(
      "No mobile money provider configured"
    );
  }

  return {
    ready:
      issues.length === 0,
    issues
  };
};

/**
 * ============================================================
 * GO LIVE REVIEW CHECK
 * ============================================================
 */
const validateGoLiveReview =
  (sacco) => {
    const issues = [];

    const compliance =
      validateCompliance(
        sacco
      );

    if (
      !compliance.compliant
    ) {
      issues.push(
        ...compliance.issues
      );
    }

    if (
      !sacco.subscription
        ?.active
    ) {
      issues.push(
        "Subscription inactive"
      );
    }

    if (
      !sacco.adminUser?.email
    ) {
      issues.push(
        "Admin user not configured"
      );
    }

    if (
      !sacco.contactPerson
    ) {
      issues.push(
        "Contact person missing"
      );
    }

    return {
      readyForReview:
        issues.length === 0,
      issues
    };
  };

/**
 * ============================================================
 * GO LIVE VALIDATION
 * ============================================================
 */
const validateGoLive = (
  sacco
) => {
  const review =
    validateGoLiveReview(
      sacco
    );

  if (
    !review.readyForReview
  ) {
    return {
      isReady: false,
      issues:
        review.issues
    };
  }

  const issues = [];

  if (
    !sacco.onboardingChecklist
      ?.trainingCompleted
  ) {
    issues.push(
      "Training incomplete"
    );
  }

  if (
    !sacco.onboardingChecklist
      ?.goLiveApproved
  ) {
    issues.push(
      "Go-live approval pending"
    );
  }

  return {
    isReady:
      issues.length === 0,
    issues
  };
};

/**
 * ============================================================
 * DASHBOARD STATUS METADATA
 * ============================================================
 */
const getStatusMetadata =
  (status) => {
    const map = {
      DRAFT: {
        label: "Draft",
        color: "secondary",
        risk: "LOW"
      },

      VERIFICATION: {
        label: "Verification",
        color: "primary",
        risk: "LOW"
      },

      KYC_PENDING: {
        label:
          "KYC Pending",
        color: "warning",
        risk: "MEDIUM"
      },

      KYC_APPROVED: {
        label:
          "KYC Approved",
        color: "success",
        risk: "LOW"
      },

      SUBSCRIPTION: {
        label:
          "Subscription",
        color: "info",
        risk: "LOW"
      },

      GO_LIVE_REVIEW: {
        label:
          "Go Live Review",
        color: "info",
        risk: "LOW"
      },

      LIVE: {
        label: "Live",
        color: "success",
        risk: "LOW"
      },

      SUSPENDED: {
        label:
          "Suspended",
        color: "danger",
        risk: "HIGH"
      },

      REJECTED: {
        label:
          "Rejected",
        color: "dark",
        risk: "HIGH"
      }
    };

    return (
      map[status] || {}
    );
  };

/**
 * ============================================================
 * AUDIT EVENT
 * ============================================================
 */
const generateAuditEvent =
  ({
    saccoId,
    previousStatus,
    newStatus,
    userId
  }) => ({
    entity: "SACCO",
    entityId: saccoId,

    action:
      "STATUS_CHANGED",

    before:
      previousStatus,

    after:
      newStatus,

    performedBy:
      userId,

    timestamp:
      new Date()
  });

/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */
module.exports = {
  STATES,

  WORKFLOW_ORDER,

  TRANSITIONS,

  canTransition,

  nextStep,

  previousStep,

  getStageNumber,

  calculateProgress,

  validateCompliance,

  validateMobileMoneySetup,

  validateGoLiveReview,

  validateGoLive,

  getStatusMetadata,

  generateAuditEvent
};