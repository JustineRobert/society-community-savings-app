// Transaction Model (models/Transaction.js)

// models/Transaction.js

const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    // 🔹 Core ownership
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔹 Financial details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "UGX",
    },

    // 🔹 Transaction nature
    type: {
      type: String,
      enum: ["DEPOSIT", "WITHDRAW", "TRANSFER", "PAYMENT"],
      required: true,
    },

    flow: {
      type: String,
      enum: ["credit", "debit"], // Ledger direction
      required: true,
    },

    // 🔹 MoMo / External Integration
    phone: {
      type: String,
      index: true,
    },

    momoTransactionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    externalId: {
      type: String, // ID from provider (MTN/Airtel/API)
    },

    // 🔹 Tracking & references
    reference: {
      type: String,
      index: true,
    },

    source: {
      type: String, // e.g. "MTN_MOMO", "AIRTEL", "INTERNAL"
    },

    channel: {
      type: String, // USSD, APP, API, AGENT
    },

    // 🔹 Status lifecycle
    status: {
      type: String,
      enum: ["PENDING", "SUCCESSFUL", "FAILED", "REVERSED"],
      default: "PENDING",
      index: true,
    },

    // 🔹 Reversal & linking
    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    // 🔹 Metadata (for extensibility, fraud scoring, logs)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // 🔹 Risk & fraud (future-ready)
    riskScore: {
      type: Number, // AI fraud score
      default: 0,
    },

    flagged: {
      type: Boolean,
      default: false,
    },

    // 🔹 Tenant (multi-SACCO support)
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// ✅ Indexes for performance
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ momoTransactionId: 1 });
TransactionSchema.index({ reference: 1 });

// ✅ Prevent duplicate MoMo transactions
TransactionSchema.path("momoTransactionId").validate(async function (value) {
  if (!value) return true;

  const existing = await mongoose.models.Transaction.findOne({
    momoTransactionId: value,
    _id: { $ne: this._id },
  });

  return !existing;
}, "Duplicate MoMo Transaction ID");

// ✅ Helper: check if successful
TransactionSchema.methods.isSuccessful = function () {
  return this.status === "SUCCESSFUL";
};

// ✅ Helper: mark failed
TransactionSchema.methods.markFailed = function (reason) {
  this.status = "FAILED";
  this.metadata = { ...this.metadata, failureReason: reason };
  return this.save();
};

module.exports = mongoose.model("Transaction", TransactionSchema);
