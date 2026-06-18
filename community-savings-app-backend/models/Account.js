// models/Account.js
'use strict';

const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const AccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      maxlength: [128, 'Account name too long'],
    },

    type: {
      type: String,
      enum: {
        values: ACCOUNT_TYPES,
        message: 'Type must be one of ' + ACCOUNT_TYPES.join(', '),
      },
      required: [true, 'Account type is required'],
      uppercase: true,
      trim: true,
    },

    code: {
      type: String,
      required: [true, 'Account code is required'],
      trim: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant is required'],
      index: true,
    },

    currency: {
      type: String,
      default: 'UGX',
      uppercase: true,
      trim: true,
      maxlength: 3,
    },

    balance: {
      type: mongoose.Schema.Types.Decimal128,
      default: mongoose.Types.Decimal128.fromString('0.00'),
      get: (v) => (v ? parseFloat(v.toString()) : 0),
      set: (v) => mongoose.Types.Decimal128.fromString(Number(v || 0).toFixed(2)),
    },

    accountNumber: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: false },
    toObject: { getters: true, virtuals: false },
  }
);

// Compound unique index: code must be unique per tenant
AccountSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'tenant_code_unique' });

// Optional: ensure accountNumber is unique per tenant when present
AccountSchema.index({ tenantId: 1, accountNumber: 1 }, { unique: true, sparse: true, name: 'tenant_accountNumber_unique' });

// Normalize fields before save
AccountSchema.pre('save', function (next) {
  if (this.type) this.type = String(this.type).toUpperCase();
  if (this.currency) this.currency = String(this.currency).toUpperCase();
  next();
});

// Soft delete helper
AccountSchema.methods.softDelete = async function (deletedBy = null) {
  this.isDeleted = true;
  this.isActive = false;
  if (!this.metadata) this.metadata = {};
  this.metadata.deletedBy = deletedBy;
  this.metadata.deletedAt = new Date();
  return this.save();
};

// Plugin for nicer unique constraint errors
AccountSchema.plugin(uniqueValidator, { message: '{PATH} must be unique.' });

module.exports = mongoose.model('Account', AccountSchema);
