// Redis-backed token bucket rate limiter
const redis = require('redis');

class TokenBucketLimiter {
  constructor(redisClient, opts = {}) {
    this.redis = redisClient;
    this.tokens = opts.tokens || 60;
    this.refillRatePerSecond = opts.tokens / opts.refillIntervalSec || 1;
    this.logger = opts.logger || console;
  }

  async allow(key, cost = 1) {
    try {
      const now = Date.now();
      const bucket = await this.getBucket(key);
      
      if (!bucket.lastRefill) {
        bucket.lastRefill = now;
        bucket.tokens = this.tokens;
      }

      const timePassed = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(this.tokens, bucket.tokens + timePassed * this.refillRatePerSecond);
      bucket.lastRefill = now;

      if (bucket.tokens >= cost) {
        bucket.tokens -= cost;
        // Store updated bucket
        await this.redis.setex(`${key}:bucket`, 3600, JSON.stringify(bucket));
        return { allowed: true, remaining: Math.floor(bucket.tokens) };
      }

      return { allowed: false, retryAfter: Math.ceil((cost - bucket.tokens) / this.refillRatePerSecond) };
    } catch (err) {
      this.logger.error('Rate limiter error', err);
      // Fail open: allow on redis error
      return { allowed: true, remaining: this.tokens };
    }
  }

  async getBucket(key) {
    const stored = await this.redis.get(`${key}:bucket`);
    return stored ? JSON.parse(stored) : { tokens: this.tokens, lastRefill: Date.now() };
  }
}

module.exports = TokenBucketLimiter;
