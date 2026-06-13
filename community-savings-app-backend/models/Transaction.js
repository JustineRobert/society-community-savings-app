// models/Transaction.js
// Production-ready Transaction model

const mongoose = require("mongoose");
const { Schema } = mongoose;

const TransactionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "tenantId is required"],
      index: true,
    },

    momoTransactionId: {
      type: String,
      trim: true,
      maxlength: 128,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: 128,
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: [true, "amount is required"],
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "UGX",
      maxlength: [3, "currency must be a 3-letter ISO code"],
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
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
  }
);

/* Schema-level indexes */
TransactionSchema.index({ momoTransactionId: 1 });
TransactionSchema.index({ tenantId: 1, status: 1 });

/* Unique per-tenant validation for momoTransactionId */
TransactionSchema.path("momoTransactionId").validate(
  async function (value) {
    if (!value) return true;
    if (!this.isNew && !this.isModified("momoTransactionId")) return true;
    const query = { momoTransactionId: value };
    if (this.tenantId) query.tenantId = this.tenantId;
    const existing = await mongoose.models.Transaction.findOne(query).lean().exec();
    return !existing;
  },
  "momoTransactionId must be unique per tenant"
);

/* Defensive export to avoid duplicate model registration */
const Transaction =
  mongoose.models && mongoose.models.Transaction
    ? mongoose.models.Transaction
    : mongoose.model("Transaction", TransactionSchema);

module.exports = Transaction;
