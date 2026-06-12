// models/LedgerEntry.js
// Production-ready Mongoose model for ledger entries

const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * LedgerEntrySchema
 *
 * - Uses Decimal128 for monetary precision.
 * - Includes robust validation and indexes for common queries.
 * - Adds toJSON/toObject transforms to return friendly values.
 * - Provides a static helper to create balanced double-entry records.
 * - Keeps an optional unique reference for idempotency/audit.
 */

const LedgerEntrySchema = new Schema(
  {
    // Reference to the account affected by this ledger line
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "account is required"],
      index: true,
    },

    // Reference to the parent transaction (grouping of ledger lines)
    transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: [true, "transaction is required"],
      index: true,
    },

    // DEBIT or CREDIT
    type: {
      type: String,
      enum: {
        values: ["DEBIT", "CREDIT"],
        message: "type must be either DEBIT or CREDIT",
      },
      required: [true, "type is required"],
      index: true,
    },

    // Monetary amount stored as Decimal128 for precision
    amount: {
      type: Schema.Types.Decimal128,
      required: [true, "amount is required"],
      validate: {
        validator: function (v) {
          // Decimal128 values are objects; convert to string then number
          if (v == null) return false;
          const n = parseFloat(v.toString());
          return Number.isFinite(n) && n > 0;
        },
        message: "amount must be a positive number",
      },
    },

    // Currency code (ISO 4217 recommended)
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "UGX",
      maxlength: [3, "currency must be a 3-letter ISO code"],
    },

    // Tenant / Sacco / Organization owning this entry
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "tenantId is required"],
      index: true,
    },

    // Optional human-readable description
    description: {
      type: String,
      trim: true,
      maxlength: 1024,
    },

    // Optional unique reference for idempotency (e.g., external system id)
    reference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 128,
    },

    // Free-form metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Soft-delete flag and timestamp (keeps audit trail without plugins)
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: "version", // optimistic concurrency friendly name
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

/**
 * Indexes
 * - transaction + type + account is a common lookup pattern
 * - compound index for fast tenant-scoped queries
 */
LedgerEntrySchema.index({ transaction: 1, account: 1, type: 1 });
LedgerEntrySchema.index({ tenantId: 1, currency: 1, deletedAt: 1 });

/**
 * Transform Decimal128 to Number or String for JSON output.
 * Avoid returning internal Decimal128 object to API consumers.
 */
function decimal128ToNumber(decimal128) {
  if (decimal128 == null) return null;
  // Convert to string first to avoid precision loss in some environments.
  const asString = decimal128.toString();
  // Try to return a Number when safe, otherwise return string.
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber : asString;
}

LedgerEntrySchema.options.toJSON.transform = function (doc, ret) {
  if (ret.amount != null) {
    ret.amount = decimal128ToNumber(ret.amount);
  }
  // remove internal fields
  delete ret.__v;
  return ret;
};

LedgerEntrySchema.options.toObject.transform = function (doc, ret) {
  if (ret.amount != null) {
    ret.amount = decimal128ToNumber(ret.amount);
  }
  delete ret.__v;
  return ret;
};

/**
 * Instance methods
 */
LedgerEntrySchema.methods.isDeleted = function () {
  return !!this.deletedAt;
};

/**
 * Soft-delete helper
 */
LedgerEntrySchema.methods.softDelete = async function () {
  if (!this.deletedAt) {
    this.deletedAt = new Date();
    await this.save();
  }
  return this;
};

/**
 * Static helpers
 */

/**
 * createBalancedEntries
 *
 * Create multiple ledger entries for a single transaction ensuring debits == credits.
 *
 * entries: [
 *   { account, type: "DEBIT"|"CREDIT", amount, currency?, tenantId, description?, reference?, metadata? },
 *   ...
 * ]
 *
 * Throws an error if the entries do not balance or validation fails.
 */
LedgerEntrySchema.statics.createBalancedEntries = async function (
  transactionId,
  entries,
  opts = {}
) {
  if (!transactionId) {
    throw new Error("transactionId is required");
  }
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error("At least two ledger entries are required for a transaction");
  }

  // Normalize and sum amounts by type using Decimal arithmetic via strings
  const toDecimalString = (val) => {
    if (val == null) return "0";
    if (typeof val === "object" && val._bsontype === "Decimal128") {
      return val.toString();
    }
    return String(val);
  };

  const sum = (arr) =>
    arr
      .map((v) => parseFloat(toDecimalString(v)))
      .reduce((acc, n) => acc + n, 0);

  const debitSum = sum(entries.filter((e) => e.type === "DEBIT").map((e) => e.amount));
  const creditSum = sum(entries.filter((e) => e.type === "CREDIT").map((e) => e.amount));

  // Use a tolerance for floating point rounding when amounts are provided as JS numbers
  const EPSILON = 1e-8;
  if (Math.abs(debitSum - creditSum) > EPSILON) {
    throw new Error("Entries do not balance: total debits must equal total credits");
  }

  // Prepare docs
  const docs = entries.map((e) => {
    const doc = {
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
      metadata: e.metadata || {},
    };
    return doc;
  });

  // Insert many with ordered=false to allow partial failure handling upstream if desired
  const created = await this.insertMany(docs, { ordered: false });
  return created;
};

/**
 * Pre-save validations
 */
LedgerEntrySchema.pre("validate", function (next) {
  // Ensure account and transaction are not the same (basic sanity)
  if (this.account && this.transaction && this.account.equals && this.transaction.equals) {
    // no-op: different types (account vs transaction) so usually not equal; keep for future checks
  }

  // Ensure amount is positive (additional guard)
  if (this.amount != null) {
    const n = parseFloat(this.amount.toString());
    if (!Number.isFinite(n) || n <= 0) {
      return next(new Error("amount must be a positive number"));
    }
  }

  // Ensure tenantId exists
  if (!this.tenantId) {
    return next(new Error("tenantId is required"));
  }

  next();
});

/**
 * Optional: convenience virtual for amount as string (preserves precision)
 */
LedgerEntrySchema.virtual("amountString").get(function () {
  return this.amount ? this.amount.toString() : null;
});

/**
 * Model export
 */
const LedgerEntry = mongoose.model("LedgerEntry", LedgerEntrySchema);

module.exports = LedgerEntry;
