// models/Transaction.js
"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const VALID_STATUSES = ["pending", "completed", "failed", "canceled"];
const VALID_TYPES = ["deposit", "withdrawal", "transfer", "payment", "loan", "repayment"];

const TransactionSchema = new Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: VALID_TYPES,
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
      enum: VALID_STATUSES,
      default: "pending",
      index: true,
    },

    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 128,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    archived: {
      type: Boolean,
      default: false,
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
TransactionSchema.index({ tenantId: 1, type: 1, status: 1, createdAt: -1 }, { background: true });
TransactionSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true, background: true });

// 🔹 Decimal128 transform for JSON output
function decimal128ToNumber(decimal128) {
  if (!decimal128) return null;
  const asString = decimal128.toString();
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber : asString;
}

TransactionSchema.options.toJSON.transform = function (doc, ret) {
  if (ret.amount != null) ret.amount = decimal128ToNumber(ret.amount);
  delete ret.__v;
  return ret;
};

TransactionSchema.options.toObject.transform = function (doc, ret) {
  if (ret.amount != null) ret.amount = decimal128ToNumber(ret.amount);
  delete ret.__v;
  return ret;
};

// Defensive export
const Transaction =
  mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);

module.exports = Transaction;
