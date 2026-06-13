// models/LedgerEntry.js
// Production-ready Mongoose model for ledger entries

const mongoose = require("mongoose");
const { Schema } = mongoose;

const LedgerEntrySchema = new Schema(
  {
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "account is required"],
      index: true,
    },

    transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: [true, "transaction is required"],
      index: true,
    },

    type: {
      type: String,
      enum: {
        values: ["DEBIT", "CREDIT"],
        message: "type must be either DEBIT or CREDIT",
      },
      required: [true, "type is required"],
      index: true,
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: [true, "amount is required"],
      validate: {
        validator: function (v) {
          if (v == null) return false;
          const n = parseFloat(v.toString());
          return Number.isFinite(n) && n > 0;
        },
        message: "amount must be a positive number",
      },
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "UGX",
      maxlength: [3, "currency must be a 3-letter ISO code"],
    },

    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "tenantId is required"],
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1024,
    },

    // Keep unique constraint on field; do NOT also create a separate schema.index({ reference: 1 })
    reference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 128,
    },

    momoTransactionId: {
      type: String,
      trim: true,
      maxlength: 128,
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
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

/* Schema-level indexes (define once). 
   NOTE: do NOT define an index for `reference` here because `unique: true` on the field already creates an index. */
LedgerEntrySchema.index({ transaction: 1, account: 1, type: 1 });
LedgerEntrySchema.index({ tenantId: 1, currency: 1, deletedAt: 1 });
LedgerEntrySchema.index({ momoTransactionId: 1 });

/* Decimal128 transform */
function decimal128ToNumber(decimal128) {
  if (decimal128 == null) return null;
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

/* Instance methods */
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

/* Static helpers */
LedgerEntrySchema.statics.createBalancedEntries = async function (
  transactionId,
  entries,
  opts = {}
) {
  if (!transactionId) throw new Error("transactionId is required");
  if (!Array.isArray(entries) || entries.length < 2)
    throw new Error("At least two ledger entries are required for a transaction");

  const toDecimalString = (val) => {
    if (val == null) return "0";
    if (typeof val === "object" && val._bsontype === "Decimal128") return val.toString();
    return String(val);
  };

  const sum = (arr) =>
    arr.map((v) => parseFloat(toDecimalString(v))).reduce((acc, n) => acc + n, 0);

  const debitSum = sum(entries.filter((e) => e.type === "DEBIT").map((e) => e.amount));
  const creditSum = sum(entries.filter((e) => e.type === "CREDIT").map((e) => e.amount));

  const EPSILON = 1e-8;
  if (Math.abs(debitSum - creditSum) > EPSILON)
    throw new Error("Entries do not balance: total debits must equal total credits");

  const docs = entries.map((e) => ({
    account: e.account,
    transaction: transactionId,
    type: e.type,
    amount:
      e.amount && e.amount._bsontype === "Decimal128"
        ? e.amount
        : mongoose.Types.Decimal128.fromString(String(e.amount)),
    currency: e.currency || "UGX",
    tenantId: e.tenantId || e.tenant || opts.tenantId,
    description: e.description,
    reference: e.reference,
    momoTransactionId: e.momoTransactionId,
    metadata: e.metadata || {},
  }));

  return this.insertMany(docs, { ordered: false });
};

/* Pre-validate */
LedgerEntrySchema.pre("validate", function (next) {
  if (this.amount != null) {
    const n = parseFloat(this.amount.toString());
    if (!Number.isFinite(n) || n <= 0) return next(new Error("amount must be a positive number"));
  }
  if (!this.tenantId) return next(new Error("tenantId is required"));
  next();
});

/* Virtuals */
LedgerEntrySchema.virtual("amountString").get(function () {
  return this.amount ? this.amount.toString() : null;
});

/* Defensive export */
const LedgerEntry =
  mongoose.models && mongoose.models.LedgerEntry
    ? mongoose.models.LedgerEntry
    : mongoose.model("LedgerEntry", LedgerEntrySchema);

module.exports = LedgerEntry;
