const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permissions: { type: [String], default: [] },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false },
}, { timestamps: true });

module.exports = mongoose.model('Role', RoleSchema);
