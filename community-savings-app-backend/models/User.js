// models/User.js
// ============================================================================
// Enterprise Fintech User Model
// TITech Community Capital Platform
// ============================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

// ============================================================================
// SUB SCHEMAS
// ============================================================================

const profileSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    occupation: { type: String, trim: true, maxlength: 100 },

    avatar: {
      type: String,
      trim: true,
      validate: {
        validator: (v) =>
          !v || validator.isURL(v, { require_protocol: true }),
        message: 'Avatar must be a valid URL',
      },
    },
  },
  { _id: false }
);

const kycSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['none', 'basic', 'enhanced', 'full'],
      default: 'none',
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },

    verifiedAt: Date,

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const amlSchema = new mongoose.Schema(
  {
    riskRating: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    lastScreenedAt: Date,
  },
  { _id: false }
);

const mfaSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    secret: {
      type: String,
      select: false,
    },

    backupCodes: [
      {
        type: String,
        select: false,
      },
    ],
  },
  { _id: false }
);

const mobileMoneySchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['mtn', 'airtel', 'other'],
      default: null,
    },

    accountNumber: {
      type: String,
      trim: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// ============================================================================
// USER SCHEMA
// ============================================================================

const userSchema = new mongoose.Schema(
  {
    // ------------------------------------------------------------------------
    // BASIC INFORMATION
    // ------------------------------------------------------------------------

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      set: (v) => v?.toLowerCase(),

      validate: {
        validator: (v) => validator.isEmail(v),
        message: 'Please provide a valid email',
      },
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    phone: {
      type: String,
      trim: true,
      sparse: true,

      validate: {
        validator: (v) =>
          !v || /^\+?[1-9]\d{1,14}$/.test(v),
        message: 'Phone must be in E.164 format',
      },
    },

    // ------------------------------------------------------------------------
    // AUTHORIZATION
    // ------------------------------------------------------------------------

    role: {
      type: String,
      enum: ['user', 'admin', 'group_admin'],
      default: 'user',
      index: true,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'active',
        'disabled',
        'suspended',
        'locked',
      ],
      default: 'active',
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ------------------------------------------------------------------------
    // PROFILE
    // ------------------------------------------------------------------------

    profile: profileSchema,

    // ------------------------------------------------------------------------
    // TENANT SUPPORT
    // ------------------------------------------------------------------------

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },

    // ------------------------------------------------------------------------
    // KYC / AML
    // ------------------------------------------------------------------------

    kyc: {
      type: kycSchema,
      default: () => ({}),
    },

    aml: {
      type: amlSchema,
      default: () => ({}),
    },

    // ------------------------------------------------------------------------
    // MFA
    // ------------------------------------------------------------------------

    mfa: {
      type: mfaSchema,
      default: () => ({}),
    },

    // ------------------------------------------------------------------------
    // MOBILE MONEY
    // ------------------------------------------------------------------------

    mobileMoney: {
      type: mobileMoneySchema,
      default: () => ({}),
    },

    // ------------------------------------------------------------------------
    // PASSWORD RESET / EMAIL VERIFICATION
    // ------------------------------------------------------------------------

    verificationToken: {
      type: String,
      default: null,
      index: true,
    },

    verificationTokenExpires: {
      type: Date,
      default: null,
      index: true,
    },

    resetPasswordToken: {
      type: String,
      default: null,
      index: true,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
      index: true,
    },

    // ------------------------------------------------------------------------
    // SECURITY
    // ------------------------------------------------------------------------

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    lastLogin: {
      type: Date,
      default: null,
      index: true,
    },

    security: {
      lastPasswordChange: Date,
      lastLoginIp: String,
      lastLoginUserAgent: String,
      lastLoginAt: Date,
    },

    passwordHistory: [
      {
        hash: String,
        changedAt: Date,
      },
    ],

    sessionMetrics: {
      activeSessions: {
        type: Number,
        default: 0,
      },

      lastRefreshAt: Date,
    },

    // ------------------------------------------------------------------------
    // REFERRALS
    // ------------------------------------------------------------------------

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    bonus: {
      type: Number,
      default: 0,
      min: 0,
    },

    referrals: {
      totalReferrals: {
        type: Number,
        default: 0,
      },

      totalBonusEarned: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,

      transform(doc, ret) {
        ret.id = ret._id.toString();

        delete ret._id;
        delete ret.__v;
        delete ret.password;

        delete ret.resetPasswordToken;
        delete ret.verificationToken;

        delete ret.failedLoginAttempts;
        delete ret.lockUntil;

        delete ret.passwordHistory;

        return ret;
      },
    },

    toObject: {
      virtuals: true,

      transform(doc, ret) {
        ret.id = ret._id.toString();

        delete ret._id;
        delete ret.__v;
        delete ret.password;

        delete ret.resetPasswordToken;
        delete ret.verificationToken;

        delete ret.failedLoginAttempts;
        delete ret.lockUntil;

        delete ret.passwordHistory;

        return ret;
      },
    },
  }
);

// ============================================================================
// PASSWORD HASHING
// ============================================================================

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    if (this.password) {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(
        this.password,
        salt
      );

      if (!this.isNew) {
        this.passwordHistory.push({
          hash: hashedPassword,
          changedAt: new Date(),
        });

        if (this.passwordHistory.length > 5) {
          this.passwordHistory =
            this.passwordHistory.slice(-5);
        }
      }

      this.password = hashedPassword;
      this.security.lastPasswordChange =
        new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre(
  'findOneAndUpdate',
  async function (next) {
    const update = this.getUpdate();

    if (!update) {
      return next();
    }

    const password =
      update.password ||
      update?.$set?.password;

    if (!password) {
      return next();
    }

    try {
      const salt = await bcrypt.genSalt(
        SALT_ROUNDS
      );

      const hashed = await bcrypt.hash(
        password,
        salt
      );

      if (update.password) {
        update.password = hashed;
      }

      if (update.$set?.password) {
        update.$set.password = hashed;
      }

      next();
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// METHODS
// ============================================================================

userSchema.methods.matchPassword =
  async function (enteredPassword) {
    if (!this.password) {
      return false;
    }

    return bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

userSchema.methods.generateResetToken =
  function () {
    const token = crypto
      .randomBytes(32)
      .toString('hex');

    this.resetPasswordToken =
      crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    this.resetPasswordExpires =
      new Date(
        Date.now() + 15 * 60 * 1000
      );

    return token;
  };

userSchema.methods.generateVerificationToken =
  function () {
    const token = crypto
      .randomBytes(32)
      .toString('hex');

    this.verificationToken =
      crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    this.verificationTokenExpires =
      new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

    return token;
  };

userSchema.methods.isLocked =
  function () {
    return Boolean(
      this.lockUntil &&
      this.lockUntil > Date.now()
    );
  };

userSchema.methods.bumpFailedLogin =
  async function (
    threshold = 5,
    lockMinutes = 15
  ) {
    if (this.isLocked()) {
      return;
    }

    this.failedLoginAttempts += 1;

    if (
      this.failedLoginAttempts >=
      threshold
    ) {
      this.lockUntil = new Date(
        Date.now() +
          lockMinutes * 60 * 1000
      );

      this.status = 'locked';
    }

    await this.save({
      validateBeforeSave: false,
    });
  };

userSchema.methods.resetFailedLogin =
  async function () {
    this.failedLoginAttempts = 0;
    this.lockUntil = null;

    if (this.status === 'locked') {
      this.status = 'active';
    }

    await this.save({
      validateBeforeSave: false,
    });
  };

// ============================================================================
// INDEXES
// ============================================================================

userSchema.index({
  email: 1,
  isActive: 1,
});

userSchema.index({
  tenantId: 1,
  status: 1,
});

userSchema.index({
  role: 1,
  status: 1,
});

userSchema.index({
  'kyc.status': 1,
});

userSchema.index({
  'aml.riskRating': 1,
});

userSchema.index({
  createdAt: -1,
});

userSchema.index({
  lastLogin: -1,
});

userSchema.index({
  isVerified: 1,
  createdAt: -1,
});

// ============================================================================

module.exports = mongoose.model(
  'User',
  userSchema
);