// models/Setting.js
'use strict';

const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'app', unique: true }, // enforce single doc

    appName: { type: String, default: 'Community Savings App', trim: true },

    allowRegistrations: { type: Boolean, default: true },

    currency: {
      type: String,
      default: 'UGX',
      uppercase: true,
      trim: true,
      maxlength: 3,
    },

    supportEmail: {
      type: String,
      default: 'support@example.com',
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },

    maintenanceMode: { type: Boolean, default: false },

    maxGroupMembers: { type: Number, default: 50, min: 1 },

    tenantId: { type: String, index: true },

    isDeleted: { type: Boolean, default: false, index: true },

    auditLog: [
      {
        action: { type: String, trim: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

// Static helpers
settingSchema.statics.getSettings = async function () {
  return this.findOne({ isDeleted: false });
};

settingSchema.statics.updateSettings = async function (updates, userId) {
  let settings = await this.findOne({ isDeleted: false });
  if (!settings) settings = await this.create(updates);
  Object.assign(settings, updates);
  settings.auditLog.push({ action: 'update', userId, details: updates });
  return settings.save();
};

module.exports = mongoose.model('Setting', settingSchema);
