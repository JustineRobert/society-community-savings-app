#!/usr/bin/env node
// Root-level CLI wrapper to seed an admin user into the backend DB.
// Usage examples:
//   node scripts/seed-admin-cli.js --email admin@example.com --pass StrongPass123
//   node scripts/seed-admin-cli.js --email admin@example.com --pass StrongPass123 --force

const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || args.h) {
    console.log('Usage: node scripts/seed-admin-cli.js --email <email> --pass <password> [--name <name>] [--force]');
    process.exit(0);
  }

  if (args.email) process.env.ADMIN_EMAIL = args.email;
  if (args.pass) process.env.ADMIN_PASS = args.pass;
  if (args.name) process.env.ADMIN_NAME = args.name;
  if (args.force) process.env.ADMIN_FORCE = 'true';

  // Allow overriding MONGO_URI via CLI too
  if (args.mongo) process.env.MONGO_URI = args.mongo;

  // Require dotenv in case .env is present
  try { require('dotenv').config(); } catch (e) {}

  // Require and run the backend seed script
  const seedPath = path.join(__dirname, '..', 'community-savings-app-backend', 'scripts', 'seed-admin.js');
  try {
    require(seedPath);
  } catch (err) {
    console.error('Failed to run seed script:', err);
    process.exit(1);
  }
}

main();
