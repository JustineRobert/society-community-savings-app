const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Permission', PermissionSchema);
