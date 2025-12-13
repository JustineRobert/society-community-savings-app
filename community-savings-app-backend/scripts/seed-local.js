// scripts/seed-local.js
// Run with: node scripts/seed-local.js
// Creates a test user (if missing) and sample groups for that user.

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URI_FALLBACK || 'mongodb://localhost:27017/community-savings';

const User = require('../models/User');
const Group = require('../models/Group');

(async function seed() {
  try {
    console.log('Connecting to MongoDB...', MONGO_URI);
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const email = process.env.SEED_USER_EMAIL || 'seeduser@example.com';
    const password = process.env.SEED_USER_PASSWORD || 'Password123!';
    const name = process.env.SEED_USER_NAME || 'Seed User';

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email, password });
      await user.save();
      console.log('Created seed user:', email);
    } else {
      console.log('Seed user already exists:', email);
    }

    const groupNames = ['Alpha Group', 'Beta Group', 'Gamma Group'];
    const created = [];

    for (const base of groupNames) {
      const exists = await Group.findOne({ name: new RegExp('^' + base) });
      if (exists) {
        console.log('Group exists, skipping:', exists.name);
        continue;
      }

      const group = new Group({
        name: `${base} - ${Date.now().toString().slice(-6)}`,
        members: [user._id],
        createdBy: user._id,
      });

      await group.save();
      created.push(group);
      console.log('Created group:', group.name);
    }

    console.log(`Seeding complete. Created ${created.length} new groups.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
