// models/Setting.js

const mongoose = require('mongoose');

/**
 * Application Settings Schema
 * Stores global configuration options for the system
 */
const settingSchema = new mongoose.Schema(
  {
    appName: {
      type: String,
      default: 'Community Savings App',
      trim: true,
    },
    allowRegistrations: {
      type: Boolean,
      default: true,
    },
    currency: {
      type: String,
      default: 'UGX',
      uppercase: true,
      trim: true,
    },
    supportEmail: {
      type: String,
      default: 'support@example.com',
      lowercase: true,
      trim: true,
    },

    // Extendable: Add other customizable settings as needed
    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    maxGroupMembers: {
      type: Number,
      default: 50,
      min: 1,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('Setting', settingSchema);
