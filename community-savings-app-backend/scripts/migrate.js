// scripts/migrate.js
await Group.updateMany(
  { visibility: { $exists: false } },
  { $set: { visibility: 'public' } }
);
