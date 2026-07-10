/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Validation
 * ============================================================
 */

const { body, param, validationResult } =
  require("express-validator");

/**
 * ============================================================
 * VALIDATION RESULT HANDLER
 * ============================================================
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
      message: "Validation failed",
      errors: errors.array()
    });
  }

  next();
};

/**
 * ============================================================
 * SACCO REGISTRATION
 * ============================================================
 */
exports.validateSacco = [
  body("saccoName")
    .trim()
    .notEmpty()
    .withMessage(
      "SACCO name is required"
    )
    .isLength({
      min: 3,
      max: 150
    })
    .withMessage(
      "SACCO name must be between 3 and 150 characters"
    ),

  body("registrationNumber")
    .optional()
    .isLength({
      min: 3,
      max: 100
    })
    .withMessage(
      "Invalid registration number"
    ),

  body("tinNumber")
    .optional()
    .isLength({
      min: 5,
      max: 30
    })
    .withMessage(
      "Invalid TIN number"
    ),

  body("district")
    .optional()
    .trim(),

  body("region")
    .optional()
    .trim(),

  body("country")
    .optional()
    .trim(),

  body("website")
    .optional()
    .isURL()
    .withMessage(
      "Please provide a valid website URL"
    ),

  body("phone")
    .notEmpty()
    .withMessage(
      "Phone number is required"
    )
    .matches(
      /^(\+256|256|0)(7[0-9]{8})$/
    )
    .withMessage(
      "Provide a valid Uganda phone number"
    ),

  body("email")
    .notEmpty()
    .withMessage(
      "Email address is required"
    )
    .isEmail()
    .withMessage(
      "Provide a valid email address"
    )
    .normalizeEmail(),

  body("contactPerson.fullName")
    .notEmpty()
    .withMessage(
      "Contact person name is required"
    ),

  body("contactPerson.phone")
    .notEmpty()
    .withMessage(
      "Contact person phone is required"
    ),

  body("contactPerson.email")
    .optional()
    .isEmail()
    .withMessage(
      "Invalid contact person email"
    ),

  handleValidationErrors
];

/**
 * ============================================================
 * KYC VALIDATION
 * ============================================================
 */
exports.validateKYC = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("directorNames")
    .optional()
    .isArray()
    .withMessage(
      "directorNames must be an array"
    ),

  body("boardChairperson")
    .optional()
    .notEmpty()
    .withMessage(
      "Board chairperson name required"
    ),

  body("registrationCertificate")
    .optional()
    .notEmpty(),

  body("proofOfAddress")
    .optional()
    .notEmpty(),

  body("taxComplianceCertificate")
    .optional()
    .notEmpty(),

  handleValidationErrors
];

/**
 * ============================================================
 * SUBSCRIPTION VALIDATION
 * ============================================================
 */
exports.validateSubscription = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("plan")
    .notEmpty()
    .withMessage(
      "Subscription plan required"
    )
    .isIn([
      "STARTER",
      "GROWTH",
      "ENTERPRISE",
      "CUSTOM"
    ])
    .withMessage(
      "Invalid subscription plan"
    ),

  body("billingCycle")
    .notEmpty()
    .withMessage(
      "Billing cycle required"
    )
    .isIn([
      "MONTHLY",
      "QUARTERLY",
      "ANNUAL"
    ])
    .withMessage(
      "Invalid billing cycle"
    ),

  body("price")
    .notEmpty()
    .withMessage(
      "Subscription price required"
    )
    .isNumeric()
    .withMessage(
      "Price must be numeric"
    ),

  body("currency")
    .optional()
    .isIn([
      "UGX",
      "USD",
      "KES",
      "TZS"
    ])
    .withMessage(
      "Unsupported currency"
    ),

  handleValidationErrors
];

/**
 * ============================================================
 * REJECTION VALIDATION
 * ============================================================
 */
exports.validateRejection = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("reason")
    .notEmpty()
    .withMessage(
      "Rejection reason required"
    )
    .isLength({
      min: 10,
      max: 1000
    })
    .withMessage(
      "Reason must be between 10 and 1000 characters"
    ),

  handleValidationErrors
];

/**
 * ============================================================
 * DOCUMENT UPLOAD VALIDATION
 * ============================================================
 */
exports.validateDocumentUpload = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  handleValidationErrors
];

/**
 * ============================================================
 * SACCO STATUS CHANGE VALIDATION
 * ============================================================
 */
exports.validateStatusChange = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  body("status")
    .isIn([
      "DRAFT",
      "VERIFICATION",
      "KYC_PENDING",
      "KYC_APPROVED",
      "SUBSCRIPTION",
      "LIVE",
      "SUSPENDED",
      "REJECTED"
    ])
    .withMessage(
      "Invalid status provided"
    ),

  handleValidationErrors
];

/**
 * ============================================================
 * GO LIVE VALIDATION
 * ============================================================
 */
exports.validateGoLive = [
  param("id")
    .isMongoId()
    .withMessage(
      "Invalid SACCO ID"
    ),

  handleValidationErrors
];

/**
 * ============================================================
 * QUERY VALIDATION
 * ============================================================
 */
exports.validateListing = [
  body("page")
    .optional()
    .isInt({
      min: 1
    }),

  body("limit")
    .optional()
    .isInt({
      min: 1,
      max: 100
    }),

  handleValidationErrors
];

/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */
module.exports = {
  validateSacco: exports.validateSacco,
  validateKYC: exports.validateKYC,
  validateSubscription:
    exports.validateSubscription,
  validateRejection:
    exports.validateRejection,
  validateDocumentUpload:
    exports.validateDocumentUpload,
  validateStatusChange:
    exports.validateStatusChange,
  validateGoLive:
    exports.validateGoLive,
  validateListing:
    exports.validateListing
};