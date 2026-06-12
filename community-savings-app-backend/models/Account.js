// models/Account.js

const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
      required: true,
    },

    code: {
      type: String,
      required: true,
      unique: true, // e.g. 1001, 2001
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    currency: {
      type: String,
      default: "UGX",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Account", AccountSchema);
``