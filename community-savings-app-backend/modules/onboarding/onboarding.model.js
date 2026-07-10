/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Model
 * ============================================================
 */

const mongoose = require("mongoose");

/**
 * ============================================================
 * KYC DOCUMENTS
 * ============================================================
 */
const DocumentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true
    },

    fileType: String,

    fileSize: Number,

    path: {
      type: String,
      required: true
    },

    uploadedBy: {
      type: String
    },

    uploadedAt: {
      type: Date,
      default: Date.now
    },

    verified: {
      type: Boolean,
      default: false
    },

    verifiedBy: String,

    verifiedAt: Date
  },
  { _id: false }
);

/**
 * ============================================================
 * SUBSCRIPTION
 * ============================================================
 */
const SubscriptionSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: [
        "STARTER",
        "GROWTH",
        "ENTERPRISE",
        "CUSTOM"
      ]
    },

    billingCycle: {
      type: String,
      enum: [
        "MONTHLY",
        "QUARTERLY",
        "ANNUAL"
      ]
    },

    currency: {
      type: String,
      default: "UGX"
    },

    price: {
      type: Number,
      default: 0
    },

    activatedAt: Date,

    activatedBy: String,

    expiresAt: Date,

    active: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

/**
 * ============================================================
 * CONTACT PERSON
 * ============================================================
 */
const ContactPersonSchema = new mongoose.Schema(
  {
    fullName: String,

    designation: String,

    phone: String,

    email: String,

    nationalId: String
  },
  { _id: false }
);

/**
 * ============================================================
 * TENANT SETTINGS
 * ============================================================
 */
const TenantSettingsSchema = new mongoose.Schema(
  {
    subdomain: String,

    brandingLogo: String,

    primaryColor: String,

    secondaryColor: String,

    timezone: {
      type: String,
      default: "Africa/Kampala"
    },

    defaultCurrency: {
      type: String,
      default: "UGX"
    }
  },
  { _id: false }
);

/**
 * ============================================================
 * MAIN SACCO SCHEMA
 * ============================================================
 */
const SaccoSchema = new mongoose.Schema(
  {
    /**
     * ========================================================
     * TENANT
     * ========================================================
     */
    tenantId: {
      type: String,
      required: true,
      index: true
    },

    /**
     * ========================================================
     * BASIC DETAILS
     * ========================================================
     */
    saccoName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    registrationNumber: {
      type: String,
      unique: true,
      sparse: true
    },

    tinNumber: String,

    district: String,

    region: String,

    country: {
      type: String,
      default: "Uganda"
    },

    physicalAddress: String,

    postalAddress: String,

    website: String,

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },

    phone: {
      type: String,
      required: true
    },

    /**
     * ========================================================
     * CONTACT PERSON
     * ========================================================
     */
    contactPerson: ContactPersonSchema,

    /**
     * ========================================================
     * STATUS
     * ========================================================
     */
    status: {
      type: String,
      enum: [
        "DRAFT",
        "VERIFICATION",
        "KYC_PENDING",
        "KYC_APPROVED",
        "SUBSCRIPTION",
        "LIVE",
        "SUSPENDED",
        "REJECTED"
      ],
      default: "DRAFT",
      index: true
    },

    /**
     * ========================================================
     * KYC
     * ========================================================
     */
    kycCompleted: {
      type: Boolean,
      default: false
    },

    kycApprovedBy: String,

    kycApprovedAt: Date,

    kycData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /**
     * ========================================================
     * DOCUMENTS
     * ========================================================
     */
    documents: [DocumentSchema],

    /**
     * ========================================================
     * SUBSCRIPTION
     * ========================================================
     */
    subscription: SubscriptionSchema,

    /**
     * ========================================================
     * TENANT SETTINGS
     * ========================================================
     */
    tenantSettings: TenantSettingsSchema,

    /**
     * ========================================================
     * GO LIVE
     * ========================================================
     */
    liveAt: Date,

    liveBy: String,

    /**
     * ========================================================
     * REJECTION
     * ========================================================
     */
    rejectedBy: String,

    rejectedAt: Date,

    rejectionReason: String,

    /**
     * ========================================================
     * BUSINESS METRICS
     * ========================================================
     */
    expectedMembers: {
      type: Number,
      default: 0
    },

    currentMembers: {
      type: Number,
      default: 0
    },

    expectedLoanPortfolio: {
      type: Number,
      default: 0
    },

    monthlyRevenueEstimate: {
      type: Number,
      default: 0
    },

    /**
     * ========================================================
     * MOBILE MONEY READINESS
     * ========================================================
     */
    mobileMoneyEnabled: {
        /**
     * ========================================================
     * MOBILE MONEY READINESS
     * ========================================================
     */
    mobileMoneyEnabled: {
      type: Boolean,
      default: false
    },

    mtnMomoEnabled: {
      type: Boolean,
      default: false
    },

    airtelMoneyEnabled: {
      type: Boolean,
      default: false
    },

    mtnCollectionAccount: {
      type: String,
      default: null
    },

    airtelCollectionAccount: {
      type: String,
      default: null
    },

    /**
     * ========================================================
     * BRANCH INFORMATION
     * ========================================================
     */
    branchCount: {
      type: Number,
      default: 1
    },

    headquartersBranch: {
      type: String,
      default: "MAIN"
    },

    /**
     * ========================================================
     * STAFF ESTIMATES
     * ========================================================
     */
    expectedStaff: {
      type: Number,
      default: 0
    },

    currentStaff: {
      type: Number,
      default: 0
    },

    /**
     * ========================================================
     * OPERATIONAL READINESS
     * ========================================================
     */
    onboardingProgress: {
      type: Number,
      default: 0
    },

    onboardingChecklist: {
      registrationCompleted: {
        type: Boolean,
        default: false
      },

      kycCompleted: {
        type: Boolean,
        default: false
      },

      subscriptionCompleted: {
        type: Boolean,
        default: false
      },

      tenantSetupCompleted: {
        type: Boolean,
        default: false
      },

      adminCreated: {
        type: Boolean,
        default: false
      },

      mobileMoneyConfigured: {
        type: Boolean,
        default: false
      },

      trainingCompleted: {
        type: Boolean,
        default: false
      },

      goLiveApproved: {
        type: Boolean,
        default: false
      }
    },

    /**
     * ========================================================
     * ADMIN ACCOUNT
     * ========================================================
     */
    adminUser: {
      fullName: String,
      email: String,
      phone: String
    },

    /**
     * ========================================================
     * SACCO CONFIGURATION
     * ========================================================
     */
    systemConfiguration: {
      loanModuleEnabled: {
        type: Boolean,
        default: true
      },

      savingsModuleEnabled: {
        type: Boolean,
        default: true
      },

      sharesModuleEnabled: {
        type: Boolean,
        default: true
      },

      investmentsModuleEnabled: {
        type: Boolean,
        default: false
      },

      accountingModuleEnabled: {
        type: Boolean,
        default: true
      }
    },

    /**
     * ========================================================
     * COMPLIANCE
     * ========================================================
     */
    complianceStatus: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "COMPLIANT",
        "NON_COMPLIANT"
      ],
      default: "PENDING"
    },

    complianceReviewedBy: String,

    complianceReviewedAt: Date,

    /**
     * ========================================================
     * AUDIT INFO
     * ========================================================
     */
    createdBy: {
      type: String,
      default: null
    },

    updatedBy: {
      type: String,
      default: null
    },

    lastActivityAt: {
      type: Date,
      default: Date.now
    },

    /**
     * ========================================================
     * SOFT DELETE
     * ========================================================
     */
    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: Date,

    deletedBy: String
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/**
 * ============================================================
 * INDEXES
 * ============================================================
 */

SaccoSchema.index({
  tenantId: 1
});

SaccoSchema.index({
  status: 1
});

SaccoSchema.index({
  email: 1
});

SaccoSchema.index({
  registrationNumber: 1
});

SaccoSchema.index({
  createdAt: -1
});

SaccoSchema.index({
  tenantId: 1,
  status: 1
});

SaccoSchema.index({
  tenantId: 1,
  createdAt: -1
});

/**
 * ============================================================
 * VIRTUALS
 * ============================================================
 */

SaccoSchema.virtual("isLive").get(function () {
  return this.status === "LIVE";
});

SaccoSchema.virtual("isRejected").get(function () {
  return this.status === "REJECTED";
});

SaccoSchema.virtual("isKYCApproved").get(function () {
  return this.status === "KYC_APPROVED";
});

SaccoSchema.virtual("subscriptionActive").get(function () {
  return this.subscription?.active || false;
});

/**
 * ============================================================
 * METHODS
 * ============================================================
 */

SaccoSchema.methods.markAsLive = function (userId) {
  this.status = "LIVE";
  this.liveAt = new Date();
  this.liveBy = userId;

  return this.save();
};

SaccoSchema.methods.rejectApplication =
  function (reason, userId) {
    this.status = "REJECTED";
    this.rejectionReason = reason;
    this.rejectedBy = userId;
    this.rejectedAt = new Date();

    return this.save();
  };

SaccoSchema.methods.updateProgress =
  function () {
    let completed = 0;

    const checklist =
      this.onboardingChecklist || {};

    Object.keys(checklist).forEach((key) => {
      if (checklist[key]) completed += 1;
    });

    this.onboardingProgress =
      Math.round(
        (completed / 8) * 100
      );

    return this.onboardingProgress;
  };

/**
 * ============================================================
 * PRE SAVE
 * ============================================================
 */

SaccoSchema.pre("save", function (next) {
  this.lastActivityAt = new Date();

  this.updateProgress();

  next();
});

/**
 * ============================================================
 * STATIC METHODS
 * ============================================================
 */

SaccoSchema.statics.getMetrics =
  async function () {
    const [
      total,
      draft,
      kycApproved,
      live,
      rejected
    ] = await Promise.all([
      this.countDocuments(),
      this.countDocuments({
        status: "DRAFT"
      }),
      this.countDocuments({
        status: "KYC_APPROVED"
      }),
      this.countDocuments({
        status: "LIVE"
      }),
      this.countDocuments({
        status: "REJECTED"
      })
    ]);

    return {
      total,
      draft,
      kycApproved,
      live,
      rejected
    };
  };

/**
 * ============================================================
 * JSON SETTINGS
 * ============================================================
 */

SaccoSchema.set("toJSON", {
  virtuals: true
});

SaccoSchema.set("toObject", {
  virtuals: true
});

/**
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = mongoose.model(
  "Sacco",
  SaccoSchema
);