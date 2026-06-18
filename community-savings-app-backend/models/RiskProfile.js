// models/RiskProfile.js
const mongoose = require("mongoose");

const RiskProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    creditScore: {
      type: Number,
      min: 0,
      max: 1000,
      default: 0,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
  },
  { timestamps: true }
);

/**
 * Pre-save hook: automatically compute riskLevel from creditScore
 */
RiskProfileSchema.pre("save", function (next) {
  this.riskLevel = mongoose.model("RiskProfile").computeRiskLevel(this.creditScore);
  next();
});

/**
 * Static helper: compute risk level from score
 * @param {number} score - Credit score (0–1000)
 * @returns {string} - Risk level ("LOW", "MEDIUM", "HIGH")
 */
RiskProfileSchema.statics.computeRiskLevel = function (score) {
  const s = Math.max(0, Math.min(1000, Math.round(score || 0)));
  if (s < 400) return "HIGH";
  if (s <= 650) return "MEDIUM";
  return "LOW";
};

module.exports = mongoose.model("RiskProfile", RiskProfileSchema);
