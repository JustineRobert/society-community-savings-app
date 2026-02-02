// models/Migration.js
// ============================================================================
// Migration Model
// Tracks database schema migrations for versioning and rollback
// ============================================================================

const mongoose = require('mongoose');

const migrationSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: YYYYMMDD_HHmmss_description (e.g., 20240115_143022_create_user_indices)
    },

    name: {
      type: String,
      required: true,
      trim: true,
      // Human-readable name of the migration
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      sparse: true,
    },

    // Migration lifecycle
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'rolled_back'],
      default: 'pending',
      index: true,
    },

    // When migration started/completed
    startedAt: {
      type: Date,
      sparse: true,
    },

    completedAt: {
      type: Date,
      sparse: true,
    },

    rolledBackAt: {
      type: Date,
      sparse: true,
    },

    // Execution duration in milliseconds
    duration: {
      type: Number,
      sparse: true,
    },

    // For debugging/audit
    executedBy: {
      type: String,
      default: 'system',
    },

    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: process.env.NODE_ENV || 'development',
    },

    // Batch migrations together for atomic operations
    batch: {
      type: Number,
      index: true,
      sparse: true,
    },

    // Error details if migration failed
    error: {
      type: String,
      sparse: true,
    },

    // Rollback status and details
    rollbackError: {
      type: String,
      sparse: true,
    },

    // File path/module name for the migration
    path: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'migrations',
    versionKey: false,
  }
);

// Index for common queries
migrationSchema.index({ status: 1, environment: 1 });
migrationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Migration', migrationSchema);
