// models/AuditLog.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    level: {
      type: String,
      enum: ["INFO", "WARN", "ERROR", "DEBUG"],
      default: "INFO",
      uppercase: true,
      trim: true,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 1024,
    },

    // 🔹 Persist correlation ID for distributed tracing
    requestId: {
      type: String,
      index: true,
      trim: true,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
    },

    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    resourceType: {
      type: String,
      trim: true,
      maxlength: 64,
      index: true,
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    success: {
      type: Boolean,
      default: true,
      index: true,
    },

    error: {
      type: String,
      trim: true,
      maxlength: 1024,
    },
  },
  {
    collection: "auditlogs",
    timestamps: { createdAt: "createdAt", updatedAt: false },
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// 🔹 Indexes for fast queries
AuditLogSchema.index({ tenantId: 1, requestId: 1, createdAt: -1 }); // compound index
AuditLogSchema.index({ requestId: 1, timestamp: -1 });              // single-field index

// 🔹 Static helper to record logs
AuditLogSchema.statics.record = async function (entry = {}) {
  const AuditLog = this;
  const payload = {
    level: entry.level || "INFO",
    message: entry.message || null,
    requestId: entry.requestId || entry.meta?.requestId || null,
    meta: entry.meta || {},
    tenantId: entry.tenantId || null,
    actor: entry.actor || null,
    resourceType: entry.resourceType || null,
    resourceId: entry.resourceId || null,
    success: typeof entry.success === "boolean" ? entry.success : true,
    error: entry.error || null,
  };
  return AuditLog.create(payload);
};

// 🔹 Instance method for summaries
AuditLogSchema.methods.summary = function () {
  return {
    id: this._id,
    level: this.level,
    message: this.message,
    requestId: this.requestId,
    tenantId: this.tenantId,
    createdAt: this.createdAt,
    success: this.success,
  };
};

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
