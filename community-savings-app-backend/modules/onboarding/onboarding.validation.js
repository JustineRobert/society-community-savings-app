"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Validation
 * ============================================================================
 *
 * File:
 * backend/modules/onboarding/onboarding.validation.js
 *
 * Purpose:
 * ----------------------------------------------------------------------------
 * HTTP input validation for SACCO onboarding.
 *
 * Responsibilities:
 * ----------------------------------------------------------------------------
 * - Request shape validation
 * - Data normalization
 * - Field length protection
 * - Enum validation
 * - MongoDB ObjectId validation
 * - Pagination validation
 * - KYC payload validation
 * - Subscription validation
 * - Rejection validation
 *
 * Business rules remain in onboarding.service.js.
 * ============================================================================
 */

const {
  body,
  param,
  query,
  validationResult,
} = require("express-validator");

/**
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

const SACCO_STATUSES = [
  "DRAFT",
  "VERIFICATION",
  "KYC_PENDING",
  "KYC_APPROVED",
  "SUBSCRIPTION",
  "LIVE",
  "SUSPENDED",
  "REJECTED",
];

const SUBSCRIPTION_PLANS = [
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
  "CUSTOM",
];

const BILLING_CYCLES = [
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
];

const SUPPORTED_CURRENCIES = [
  "UGX",
  "USD",
  "KES",
  "TZS",
];

/**
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

const handleValidationErrors = (
  req,
  res,
  next
) => {
  const errors =
    validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,

      code: "VALIDATION_ERROR",

      message:
        "Request validation failed",

      errors: errors.array({
        onlyFirstError: true,
      }),
    });
  }

  next();
};

/**
 * ============================================================================
 * PHONE VALIDATION
 * ============================================================================
 *
 * Accepted examples:
 *
 * 0772123546
 * 256772123546
 * +256772123546
 *
 * ============================================================================
 */

const ugandaPhoneRegex =
  /^(?:\+256|256|0)(7\d{8})$/;

/**
 * ============================================================================
 * SACCO REGISTRATION VALIDATION
 * ============================================================================
 */

exports.validateSacco = [
  body("saccoName")
    .exists()
    .withMessage(
      "SACCO name is required"
    )
    .bail()
    .isString()
    .withMessage(
      "SACCO name must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 3,
      max: 150,
    })
    .withMessage(
      "SACCO name must be between 3 and 150 characters"
    ),

  /**
   * Client must NOT provide tenantId.
   *
   * Tenant identity must come from authenticated
   * tenant context.
   */
  body("tenantId")
    .optional()
    .custom(() => {
      throw new Error(
        "tenantId must not be supplied by the client"
      );
    }),

  body("registrationNumber")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Registration number must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 3,
      max: 100,
    })
    .withMessage(
      "Invalid registration number"
    )
    .bail()
    .matches(
      /^[A-Za-z0-9./_-]+$/
    )
    .withMessage(
      "Registration number contains invalid characters"
    ),

  body("tinNumber")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "TIN number must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 5,
      max: 30,
    })
    .withMessage(
      "Invalid TIN number"
    ),

  body("district")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "District must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 100,
    }),

  body("region")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Region must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 100,
    }),

  body("country")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Country must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 100,
    }),

  body("physicalAddress")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Physical address must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 500,
    }),

  body("postalAddress")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Postal address must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 500,
    }),

  body("website")
    .optional({
      nullable: true,
    })
    .isURL({
      protocols: [
        "http",
        "https",
      ],
      require_protocol: true,
    })
    .withMessage(
      "Please provide a valid website URL"
    ),

  body("phone")
    .exists()
    .withMessage(
      "Phone number is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Phone number must be a string"
    )
    .bail()
    .trim()
    .matches(
      ugandaPhoneRegex
    )
    .withMessage(
      "Provide a valid Uganda phone number"
    ),

  body("email")
    .exists()
    .withMessage(
      "Email address is required"
    )
    .bail()
    .isEmail()
    .withMessage(
      "Provide a valid email address"
    )
    .bail()
    .normalizeEmail(),

  /**
   * CONTACT PERSON
   */

  body("contactPerson")
    .optional({
      nullable: true,
    })
    .isObject()
    .withMessage(
      "contactPerson must be an object"
    ),

  body("contactPerson.fullName")
    .exists()
    .withMessage(
      "Contact person name is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Contact person name must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage(
      "Invalid contact person name"
    ),

  body("contactPerson.designation")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Contact designation must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 150,
    }),

  body("contactPerson.phone")
    .exists()
    .withMessage(
      "Contact person phone is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Contact person phone must be a string"
    )
    .bail()
    .trim()
    .matches(
      ugandaPhoneRegex
    )
    .withMessage(
      "Provide a valid Uganda contact phone number"
    ),

  body("contactPerson.email")
    .optional({
      nullable: true,
    })
    .isEmail()
    .withMessage(
      "Invalid contact person email"
    )
    .normalizeEmail(),

  body("contactPerson.nationalId")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "National ID must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 5,
      max: 50,
    }),

  /**
   * BUSINESS METRICS
   */

  body("expectedMembers")
    .optional()
    .isInt({
      min: 0,
      max: 100000000,
    })
    .withMessage(
      "Expected members must be a non-negative integer"
    ),

  body("expectedStaff")
    .optional()
    .isInt({
      min: 0,
      max: 1000000,
    })
    .withMessage(
      "Expected staff must be a non-negative integer"
    ),

  body("expectedLoanPortfolio")
    .optional()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Expected loan portfolio must be non-negative"
    ),

  body("monthlyRevenueEstimate")
    .optional()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Monthly revenue estimate must be non-negative"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * KYC VALIDATION
 * ============================================================================
 */

exports.validateKYC = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("directorNames")
    .optional()
    .isArray({
      min: 1,
      max: 100,
    })
    .withMessage(
      "directorNames must be an array containing 1 to 100 directors"
    ),

  body("directorNames.*")
    .optional()
    .isString()
    .withMessage(
      "Director name must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage(
      "Invalid director name"
    ),

  body("boardChairperson")
    .optional()
    .isString()
    .withMessage(
      "Board chairperson must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 150,
    }),

  body("registrationCertificate")
    .optional()
    .isString()
    .withMessage(
      "Registration certificate must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 500,
    }),

  body("proofOfAddress")
    .optional()
    .isString()
    .withMessage(
      "Proof of address must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 500,
    }),

  body("taxComplianceCertificate")
    .optional()
    .isString()
    .withMessage(
      "Tax compliance certificate must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 500,
    }),

  body("kycRiskLevel")
    .optional()
    .isIn([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ])
    .withMessage(
      "Invalid KYC risk level"
    ),

  body("notes")
    .optional()
    .isString()
    .withMessage(
      "KYC notes must be a string"
    )
    .bail()
    .trim()
    .isLength({
      max: 5000,
    }),

  handleValidationErrors,
];

/**
 * ============================================================================
 * SUBSCRIPTION VALIDATION
 * ============================================================================
 */

exports.validateSubscription = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("plan")
    .exists()
    .withMessage(
      "Subscription plan required"
    )
    .bail()
    .isIn(
      SUBSCRIPTION_PLANS
    )
    .withMessage(
      "Invalid subscription plan"
    ),

  body("billingCycle")
    .exists()
    .withMessage(
      "Billing cycle required"
    )
    .bail()
    .isIn(
      BILLING_CYCLES
    )
    .withMessage(
      "Invalid billing cycle"
    ),

  body("price")
    .exists()
    .withMessage(
      "Subscription price required"
    )
    .bail()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Subscription price must be a non-negative number"
    ),

  body("currency")
    .optional()
    .isIn(
      SUPPORTED_CURRENCIES
    )
    .withMessage(
      "Unsupported currency"
    ),

  body("expiresAt")
    .optional({
      nullable: true,
    })
    .isISO8601()
    .withMessage(
      "expiresAt must be a valid ISO date"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * REJECTION VALIDATION
 * ============================================================================
 */

exports.validateRejection = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("reason")
    .exists()
    .withMessage(
      "Rejection reason required"
    )
    .bail()
    .isString()
    .withMessage(
      "Rejection reason must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 10,
      max: 1000,
    })
    .withMessage(
      "Reason must be between 10 and 1000 characters"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * DOCUMENT UPLOAD VALIDATION
 * ============================================================================
 */

exports.validateDocumentUpload = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * DOCUMENT VERIFICATION VALIDATION
 * ============================================================================
 */

exports.validateDocumentVerification = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  param("documentId")
    .isMongoId()
    .withMessage(
      "Invalid document ID"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * STATUS CHANGE VALIDATION
 * ============================================================================
 *
 * Kept for administrative workflows.
 *
 * IMPORTANT:
 * The service MUST still enforce the transition matrix.
 * ============================================================================
 */

exports.validateStatusChange = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("status")
    .exists()
    .withMessage(
      "Status is required"
    )
    .bail()
    .isIn(
      SACCO_STATUSES
    )
    .withMessage(
      "Invalid status provided"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * GO LIVE VALIDATION
 * ============================================================================
 */

exports.validateGoLive = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * SUSPENSION VALIDATION
 * ============================================================================
 */

exports.validateSuspension = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("reason")
    .exists()
    .withMessage(
      "Suspension reason is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Suspension reason must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 10,
      max: 1000,
    })
    .withMessage(
      "Suspension reason must be between 10 and 1000 characters"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * MOBILE MONEY VALIDATION
 * ============================================================================
 */

exports.validateMtnMomoSetup = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("collectionAccount")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "MTN collection account must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 5,
      max: 100,
    }),

  handleValidationErrors,
];

exports.validateAirtelMoneySetup = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("collectionAccount")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Airtel collection account must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 5,
      max: 100,
    }),

  handleValidationErrors,
];

/**
 * ============================================================================
 * QUERY / LIST VALIDATION
 * ============================================================================
 */

exports.validateListing = [
  query("page")
    .optional()
    .isInt({
      min: 1,
      max: 1000000,
    })
    .withMessage(
      "page must be a positive integer"
    )
    .toInt(),

  query("limit")
    .optional()
    .isInt({
      min: 1,
      max: 100,
    })
    .withMessage(
      "limit must be between 1 and 100"
    )
    .toInt(),

  query("status")
    .optional()
    .isIn(
      SACCO_STATUSES
    )
    .withMessage(
      "Invalid SACCO status"
    ),

  query("search")
    .optional()
    .isString()
    .withMessage(
      "search must be a string"
    )
    .bail()
    .trim()
    .isLength({
      min: 1,
      max: 100,
    })
    .withMessage(
      "Search must be between 1 and 100 characters"
    ),

  /**
   * tenantId is deliberately NOT accepted.
   *
   * Tenant identity must be resolved from authenticated
   * tenant context.
   */
  query("tenantId")
    .not()
    .exists()
    .withMessage(
      "tenantId must not be supplied by the client"
    ),

  handleValidationErrors,
];

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports = {
  validateSacco:
    exports.validateSacco,

  validateKYC:
    exports.validateKYC,

  validateSubscription:
    exports.validateSubscription,

  validateRejection:
    exports.validateRejection,

  validateDocumentUpload:
    exports.validateDocumentUpload,

  validateDocumentVerification:
    exports.validateDocumentVerification,

  validateStatusChange:
    exports.validateStatusChange,

  validateGoLive:
    exports.validateGoLive,

  validateSuspension:
    exports.validateSuspension,

  validateMtnMomoSetup:
    exports.validateMtnMomoSetup,

  validateAirtelMoneySetup:
    exports.validateAirtelMoneySetup,

  validateListing:
    exports.validateListing,
};