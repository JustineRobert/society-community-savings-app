// models/Ledger.js
"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const LedgerSchema = new Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    transactionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    debitAccount: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    creditAccount: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: {
        validator: function (v) {
          if (!v) return false;
          const n = parseFloat(v.toString());
          return Number.isFinite(n) && n > 0;
        },
        message: "Amount must be a positive number",
      },
    },

    currency: {
      type: String,
      default: "UGX",
      uppercase: true,
      trim: true,
      maxlength: [3, "Currency must be a 3‑letter ISO code"],
    },

    status: {
      type: String,
      enum: ["posted", "pending", "canceled"],
      default: "posted",
      index: true,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: 128,
      unique: true,
      sparse: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1024,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: "version", // optimistic concurrency
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// 🔹 Indexes for common queries
LedgerSchema.index({ tenantId: 1, debitAccount: 1, creditAccount: 1 });
LedgerSchema.index({ tenantId: 1, currency: 1, status: 1, deletedAt: 1 });

// 🔹 Decimal128 transform for JSON output
function decimal128ToNumber(decimal128) {
  if (!decimal128) return null;
  const asString = decimal128.toString();
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber : asString;
}

LedgerSchema.options.toJSON.transform = function (doc, ret) {
  if (ret.amount != null) ret.amount = decimal128ToNumber(ret.amount);
  delete ret.__v;
  return ret;
};

LedgerSchema.options.toObject.transform = function (doc, ret) {
  if (ret.amount != null) ret.amount = decimal128ToNumber(ret.amount);
  delete ret.__v;
  return ret;
};

// 🔹 Instance methods
LedgerSchema.methods.isDeleted = function () {
  return !!this.deletedAt;
};

LedgerSchema.methods.softDelete = async function () {
  if (!this.deletedAt) {
    this.deletedAt = new Date();
    await this.save();
  }
  return this;
};

// Defensive export
const Ledger =
  mongoose.models.Ledger || mongoose.model("Ledger", LedgerSchema);

module.exports = Ledger;
