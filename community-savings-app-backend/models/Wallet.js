// models/Wallet.js

const mongoose = require("mongoose");

/**
 * Wallet Schema
 *
 * ✅ Supports SACCO multi-tenant architecture
 * ✅ Tracks available + pending balances
 * ✅ Audit & compliance ready
 * ✅ Prevents negative balances (controlled via services)
 */

const WalletSchema = new mongoose.Schema(
  {
    // 🔹 Ownership
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true, // SACCO isolation
    },

    // 🔹 Financial balances
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 🔹 Derived total (optional but useful)
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "UGX",
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
  },
  {
    timestamps: true, // ✅ createdAt + updatedAt
  }
);

// ✅ Unique constraint per user per tenant
WalletSchema.index({ user: 1, tenantId: 1 }, { unique: true });

// ✅ Keep balance in sync
WalletSchema.pre("save", function (next) {
  this.balance = this.availableBalance + this.pendingBalance;
  next();
});

// ✅ Helper: Check if wallet is usable
WalletSchema.methods.isActive = function () {
  return this.status === "active";
};

// ✅ Helper: Freeze wallet
WalletSchema.methods.freeze = function () {
  this.status = "frozen";
  return this.save();
};

// ✅ Helper: Resume wallet
WalletSchema.methods.activate = function () {
  this.status = "active";
  return this.save();
};

module.exports = mongoose.model("Wallet", WalletSchema);