
// models/User.js
// ============================================================================
// User Model (Mongoose)
// - Secure password hashing (bcrypt)
// - Hashed reset/verification tokens (never store raw)
// - Login lockout helpers and session hygiene
// - Clean toJSON/toObject transforms for API responses
// ============================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      set: (v) => v?.toLowerCase(),
      validate: {
        validator: (v) => validator.isEmail(v),
        message: 'Please provide a valid email',
      },
      index: true, // fast lookup
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return by default
    },

    // Single role; if you need multiple roles, also add `roles: [String]`
    role: {
      type: String,
      enum: ['user', 'admin', 'group_admin'],
      default: 'user',
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: (v) => !v || /^\+?[1-9]\d{1,14}$/.test(v),
        message: 'Phone must be in E.164 format',
      },
    },

    profile: {
      address: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 100 },
      country: { type: String, trim: true, maxlength: 100 },
      occupation: { type: String, trim: true, maxlength: 100 },
      avatar: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || validator.isURL(v, { require_protocol: true }),
          message: 'Avatar must be a valid URL',
        },
      },
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Store hashed tokens only
    verificationToken: {
      type: String,
      index: true,
      default: null,
    },
    verificationTokenExpires: {
      type: Date,
      default: null,
      index: true,
    },

    resetPasswordToken: {
      type: String,
      index: true,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      index: true,
      default: null,
    },

    bonus: {
      type: Number,
      default: 0,
      min: 0,
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true, // allow null for many users, enforce uniqueness when present
      index: true,
      trim: true,
      minlength: 6,
      maxlength: 32,
      match: [/^[A-Za-z0-9_-]+$/, 'Referral code may only contain letters, numbers, underscores, and hyphens'],
    },

    lastLogin: {
      type: Date,
      index: true,
      default: null,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      index: true,
    },

    lockUntil: {
      type: Date,
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // Normalize id
        ret.id = ret._id?.toString?.();
        delete ret._id;

        // Remove internal/sensitive fields
        delete ret.password;
        delete ret.verificationToken;
        delete ret.resetPasswordToken;
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id?.toString?.();
        delete ret._id;

        delete ret.password;
        delete ret.verificationToken;
        delete ret.resetPasswordToken;
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ----------------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------------

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash password on findOneAndUpdate if present in update document
userSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  // Supports both direct and $set updates
  const pwd = update.password || (update.$set && update.$set.password);
  if (!pwd) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashed = await bcrypt.hash(pwd, salt);
    if (update.password) update.password = hashed;
    if (update.$set && update.$set.password) update.$set.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// Methods
// ----------------------------------------------------------------------------

/**
 * Compare candidate password to hashed password.
 * Returns false if password field is not loaded (e.g., not selected in query).
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // guard if not selected
  return bcrypt.compare(enteredPassword, this.password);
};

/**
 * Generate password reset token (raw). Stores hashed token + expiry.
 */
userSchema.methods.generateResetToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  return resetToken;
};

/**
 * Generate email verification token (raw). Stores hashed token + expiry.
 */
userSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(20).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

/**
 * Returns whether the user is currently locked out.
 */
userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment failed login attempts; optionally lock account if threshold exceeded.
 * @param {number} threshold - e.g., 5 attempts
 * @param {number} lockMinutes - e.g., 15 minutes
 */
userSchema.methods.bumpFailedLogin = async function (threshold = 5, lockMinutes = 15) {
  if (this.isLocked()) return; // already locked
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;

  if (this.failedLoginAttempts >= threshold) {
    this.lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    // Optional: add audit fields or emit an event
  }
  await this.save({ validateBeforeSave: false });
};

/**
 * Reset failed login attempts and lock status (call on successful login).
 */
userSchema.methods.resetFailedLogin = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  await this.save({ validateBeforeSave: false });
};

// ----------------------------------------------------------------------------
// Indexes (additional helpful ones)
// ----------------------------------------------------------------------------

userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ isVerified: 1, createdAt: -1 });

// Optional: enforce case-insensitive unique email at DB level.
// If you need this, create the index with collation in migration/init code:
//   db.users.createIndex({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('User', userSchema);
