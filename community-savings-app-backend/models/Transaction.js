// models/Transaction.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const TransactionSchema = new Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    fromWallet: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    toWallet: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: true,
    },

    currency: {
      type: String,
      default: "UGX",
      maxlength: 3,
    },

    description: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },

    momoTransactionId: {
      type: String,
      trim: true,
      index: true,
    },

    // 🔹 Persist correlation ID for distributed tracing
    requestId: {
      type: String,
      index: true,
      trim: true,
    },

    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: "version",
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports =
  mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);
