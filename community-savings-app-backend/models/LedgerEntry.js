// models/LedgerEntry.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const LedgerEntrySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "tenantId is required"],
      index: true,
    },

    debitAccount: {
      type: String,
      required: [true, "debitAccount is required"],
      trim: true,
      index: true,
    },

    creditAccount: {
      type: String,
      required: [true, "creditAccount is required"],
      trim: true,
      index: true,
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: [true, "amount is required"],
      validate: {
        validator: function (v) {
          if (!v) return false;
          const n = parseFloat(v.toString());
          return Number.isFinite(n) && n > 0;
        },
        message: "amount must be a positive number",
      },
    },

    currency: {
      type: String,
      default: "UGX",
      uppercase: true,
      trim: true,
      maxlength: [3, "currency must be a 3-letter ISO code"],
    },

    reference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 128,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1024,
    },

    momoTransactionId: {
      type: String,
      trim: true,
      maxlength: 128,
      index: true,
    },

    // 🔹 Persist correlation ID for distributed tracing
    requestId: {
      type: String,
      index: true,
      trim: true,
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
    versionKey: "version",
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// 🔹 Indexes
LedgerEntrySchema.index({ tenantId: 1, debitAccount: 1, creditAccount: 1 });
LedgerEntrySchema.index({ tenantId: 1, currency: 1, deletedAt: 1 });
LedgerEntrySchema.index({ tenantId: 1, requestId: 1 }); // 🔹 Optimized query path

// 🔹 Decimal128 transform
function decimal128ToNumber(decimal128) {
  if (!decimal128) return null;
  const asString = decimal128.toString();
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber : asString;
}

LedgerEntrySchema.options.toJSON.transform = function (doc, ret) {
  if (ret.amount != null) ret.amount = decimal128ToNumber(ret.amount);
  delete ret.__v;
  return ret;
};

LedgerEntrySchema.options.toObject.transform = function (doc, ret) {
  if (ret.amount != null) ret.amount = decimal128ToNumber(ret.amount);
  delete ret.__v;
  return ret;
};

// 🔹 Instance methods
LedgerEntrySchema.methods.isDeleted = function () {
  return !!this.deletedAt;
};

LedgerEntrySchema.methods.softDelete = async function () {
  if (!this.deletedAt) {
    this.deletedAt = new Date();
    await this.save();
  }
  return this;
};

// Defensive export
const LedgerEntry =
  mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", LedgerEntrySchema);

module.exports = LedgerEntry;
