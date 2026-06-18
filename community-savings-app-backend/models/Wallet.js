// models/Wallet.js

const mongoose = require("mongoose");

/**
 * Wallet Schema (Production-Grade)
 *
 * ✅ Multi-tenant SACCO isolation
 * ✅ Decimal precision for financial safety
 * ✅ Audit & compliance ready
 * ✅ Prevents negative balances (via services)
 * ✅ Extensible metadata for integrations
 */

const WalletSchema = new mongoose.Schema(
  {
    // 🔹 Ownership
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    // 🔹 Financial balances (use Decimal128 for precision)
    balance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0.0,
      get: (v) => parseFloat(v.toString()), // normalize for JSON responses
    },

    currency: {
      type: String,
      default: "UGX",
      validate: {
        validator: (val) => /^[A-Z]{3}$/.test(val),
        message: "Currency must be a valid ISO 4217 code",
      },
    },

    // 🔹 Wallet status
    status: {
      type: String,
      enum: ["active", "frozen", "suspended"],
      default: "active",
    },

    // 🔹 Operational metadata
    lastTransactionAt: {
      type: Date,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // 🔹 Soft delete / archival
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
    toJSON: { getters: true }, // ensure Decimal128 is serialized cleanly
  }
);

// ✅ Unique constraint per user per tenant
WalletSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

// ✅ Helper methods
WalletSchema.methods.isActive = function () {
  return this.status === "active" && !this.isDeleted;
};

WalletSchema.methods.freeze = function () {
  this.status = "frozen";
  return this.save();
};

WalletSchema.methods.activate = function () {
  this.status = "active";
  return this.save();
};

WalletSchema.methods.suspend = function () {
  this.status = "suspended";
  return this.save();
};

// ✅ Safe credit/debit helpers
WalletSchema.methods.credit = function (amount) {
  this.balance = mongoose.Types.Decimal128.fromString(
    (this.balance + amount).toString()
  );
  this.lastTransactionAt = new Date();
  return this.save();
};

WalletSchema.methods.debit = function (amount) {
  if (parseFloat(this.balance.toString()) < amount) {
    throw new Error("Insufficient funds");
  }
  this.balance = mongoose.Types.Decimal128.fromString(
    (this.balance - amount).toString()
  );
  this.lastTransactionAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Wallet", WalletSchema);
