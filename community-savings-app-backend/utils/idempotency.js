// utils/idempotency.js
"use strict";

const redis = require("./redis");

/**
 * Check and record idempotency key
 * @param {string} key - Unique idempotency key
 * @param {number} ttlSeconds - Expiry window in seconds (default 24h)
 * @returns {boolean} - true if new, false if duplicate
 */
exports.check = async (key, ttlSeconds = 86400) => {
  if (!key) throw new Error("Idempotency key required");

  // Try to set key with NX (only if not exists)
  const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");

  return result === "OK"; // true if new, false if already exists
};

/**
 * Record metadata for debugging
 */
exports.record = async (key, meta = {}, ttlSeconds = 86400) => {
  if (!key) throw new Error("Idempotency key required");

  const value = JSON.stringify({
    ...meta,
    createdAt: new Date().toISOString(),
  });

  const result = await redis.set(key, value, "EX", ttlSeconds, "NX");
  return result === "OK";
};

/**
 * Retrieve metadata
 */
exports.get = async (key) => {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
};
